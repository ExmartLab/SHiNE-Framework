import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { connectToDatabase } from "./src/lib/mongodb.js";
import { updateDeviceInteraction } from "./src/lib/deviceInteractions.js";
import { searchDeviceAndProperty } from "./src/lib/deviceUtils.js";
import gameConfig from "./src/game.json" assert { type: "json" };
import explanationConfig from "./src/explanation.json" assert { type: "json" };
import WebSocketExplanationEngine from "./src/lib/server/explanation_engine/websocket.js";
import RestExplanationEngine from "./src/lib/server/explanation_engine/rest.js";
import Metadata from "./src/lib/server/logger/metadata.js";
import Logger from "./src/lib/server/logger/logger.js";


const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  const { db } = await connectToDatabase();

  const io = new Server(httpServer);

  let explanationEngine = null;
  let wsExplanationEngine = null;;

  if(explanationConfig.explanation_engine == "external"){
    const explanationCallback = async (data) => {
      // Get socket ID from DB
      let userData = await db.collection('sessions').findOne({ sessionId: data.user_id });
      console.log('WebSocket User Data ', userData);

      // Get current user task id
      let currentTask = await db.collection('tasks').findOne({ userSessionId: data.user_id, startTime: { $lte: new Date() }, endTime: { $gte: new Date() } });

      let currentTaskId = currentTask.taskId || '';

      let explanation = {
        'explanation': data.explanation,
        'created_at': new Date(),
        'userSessionId': userData.sessionId,
        'taskId': currentTaskId,
        'delay': 0
      }
        
      if(explanationConfig.explanation_trigger == 'on_demand'){
        await db.collection('sessions').updateOne({ sessionId: userData.sessionId }, { $set: { explanation_cache: explanation } });
      } else if(explanationConfig.explanation_trigger == 'automatic'){
        await db.collection('explanations').insertOne(explanation);
        let socketId = userData.socketId;
        io.to(socketId).emit('explanation', { explanation: data.explanation});
      }
    }

    if(explanationConfig.external_engine_type == 'ws'){
      explanationEngine = new WebSocketExplanationEngine(explanationConfig.external_explanation_engine_api, explanationCallback);
    } else if(explanationConfig.external_engine_type == 'rest'){
      explanationEngine = new RestExplanationEngine(explanationConfig.external_explanation_engine_api, explanationCallback);
    }
  }

  io.on("connection", (socket) => {
    console.log('New client connected:', socket.id);
    
    // Listen for device_interaction events
    socket.on('device-interaction', async (data) => {

      let userSession = await db.collection('sessions').findOne({ sessionId: data.sessionId });

      // Update socket id if necessary
      if(userSession.socketId != socket.id){
        // Update socketId
        await db.collection('sessions').updateOne({ sessionId: data.sessionId }, { $set: { socketId: socket.id } });
      }

      // Find the current task of the user
      let currentTime = new Date();

      let currentTask = await db.collection('tasks').findOne({ userSessionId: data.sessionId, startTime: { $lte: currentTime }, endTime: { $gte: currentTime } });
      
      if(!currentTask){
        return;
      }

      // Logger part

      const metadataEngine = new Metadata(db, gameConfig, data.sessionId);
      await metadataEngine.loadUserData();

      const logger = new Logger(db, data.sessionId, metadataEngine, explanationEngine);

      // Update interactionTimes for currentTask by 1
      await db.collection('tasks').updateOne({ userSessionId: data.sessionId, taskId: currentTask.taskId }, { $inc: { interactionTimes: 1 } });
      
      // Update device interaction in DB using the dedicated function
      let deviceInteractionLog = await updateDeviceInteraction(db, data, true);

            // logsData.push(deviceInteractionLog);

      // Context manager

      let taskDetail = gameConfig.tasks.tasks.filter((task) => task.id == currentTask.taskId)[0];


      function getInjectibleVariables(userData) {
        let injectibleVariables = {};
        if(userData['customData']){
          for (let property in userData['customData']) {
           injectibleVariables[property] = userData['customData'][property]; 
          }
        }
        return injectibleVariables;
      }

      function getInGameTime(startTime, gameConfig){
        let currentTime = new Date();
        let timeDifference = ((currentTime.getTime() - startTime.getTime()) / 1000) * gameConfig.environment.time.speed;
    
        // Based on start time
        let minute = gameConfig.environment.time.startTime.minute + Math.floor(timeDifference / 60);
        let hour = gameConfig.environment.time.startTime.hour + Math.floor(minute / 60);
        minute = (minute % 60);
        hour = (hour % 24);

        return {hour, minute};
      }

      let context = {
        time: getInGameTime(userSession.startTime, gameConfig),
        ...getInjectibleVariables(userSession),
        task: taskDetail['id'],
      }


      // Get all devices from DB
      let devices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();




      let updated_properties = [];
      let explanations = [];

      for(let i = 0; i < gameConfig.rules.length; i++){

        let preconditionsMet = false;

        // Check for each rule whether the preconditions apply
        for(let p = 0; p < gameConfig.rules[i].precondition.length; p++){

          let precondition = gameConfig.rules[i].precondition[p];

          if(precondition.type == "Device"){
            let device = precondition.device;
            let property = precondition.condition.name;
            let operator = precondition.condition.operator;
            let value = precondition.condition.value; // <=, >=, ==, !=, <, >

            let deviceValue = searchDeviceAndProperty(device, property, devices);

            // Check if the precondition is met
            if (deviceValue !== null) {
              switch (operator) {
                case '==':
                  preconditionsMet = deviceValue == value;
                  break;
                case '!=':
                  preconditionsMet = deviceValue != value;
                  break;
                case '<':
                  preconditionsMet = deviceValue < value;
                  break;
                case '>':
                  preconditionsMet = deviceValue > value;
                  break;
                case '<=':
                  preconditionsMet = deviceValue <= value;
                  break;
                case '>=':
                  preconditionsMet = deviceValue >= value;
                  break;
                default:
                  console.log(`Unknown operator: ${operator}`);
                  preconditionsMet = false;
              }
              // console.log(`Precondition check: ${device}.${property} ${operator} ${value} = ${preconditionsMet}`);
            } else {
              // console.log(`Device value not found for ${device}.${property}`);
              preconditionsMet = false;
            }
          } else if(precondition.type == "Context"){
            let injectibleVariableValue = context[precondition.condition.name];
            // Check if the precondition is met
            if (injectibleVariableValue!== null) {
              switch (precondition.condition.operator) {
                case '==':
                  preconditionsMet = injectibleVariableValue == precondition.condition.value;
                  break;
                case '!=':
                  preconditionsMet = injectibleVariableValue != precondition.condition.value;
                  break;
                case '<':
                  preconditionsMet = injectibleVariableValue < precondition.condition.value;
                  break;
                case '>':
                  preconditionsMet = injectibleVariableValue > precondition.condition.value;
                  break;
                case '<=':
                  preconditionsMet = injectibleVariableValue <= precondition.condition.value;
                  break;
                case '>=':
                  preconditionsMet = injectibleVariableValue >= precondition.condition.value;
                  break;
                default:
                  preconditionsMet = false;
              }
            } else {
              preconditionsMet = false;
            }
          } else if(precondition.type == "Time"){
            let variableValue = context['time'][precondition.condition.name];

            switch (precondition.condition.operator) {
              case '==':
                preconditionsMet = variableValue == precondition.condition.value;
                break;
              case '!=':
                preconditionsMet = variableValue != precondition.condition.value;
                break;
              case '<':
                preconditionsMet = variableValue < precondition.condition.value;
                break;
              case '>':
                preconditionsMet = variableValue > precondition.condition.value;
                break;
              case '<=':
                preconditionsMet = variableValue <= precondition.condition.value;
                break;
              case '>=':
                preconditionsMet = variableValue >= precondition.condition.value;
                break;
              default:
                preconditionsMet = false;
            }
          } 

          // If one of the preconditions is not met, break the loop
          if(!preconditionsMet){
            break;
          }
        }

        let actionRule = [];

        if(preconditionsMet){
          // If the preconditions are met, execute the actions
          for(let a = 0; a < gameConfig.rules[i].action.length; a++){
            if(gameConfig.rules[i].action[a].type == "Device_Interaction"){
              updated_properties.push({
                sessionId: data.sessionId,
                deviceId: gameConfig.rules[i].action[a].device,
                interaction: gameConfig.rules[i].action[a].interaction.name,
                value: gameConfig.rules[i].action[a].interaction.value,
                delay: gameConfig.rules[i].delay ?? 0
              });
              actionRule.push({
                'device': gameConfig.rules[i].action[a].device,
                'property': {
                  'name': gameConfig.rules[i].action[a].interaction.name,
                  'value': gameConfig.rules[i].action[a].interaction.value,
                }
              });

            } else if(gameConfig.rules[i].action[a].type == "Explanation" && explanationConfig.explanation_engine == "integrated"){
              explanations.push({
                'explanation': explanationConfig.integrated_explanation_engine[gameConfig.rules[i].action[a].explanation],
                'created_at': new Date(),
                'userSessionId': data.sessionId,
                'taskId': currentTask.taskId,
                'delay': gameConfig.rules[i].delay ?? 0
              });
            }
          }

          logger.logRuleTrigger(gameConfig.rules[i].id, actionRule);
        }
      }

      // Change in DB

      // For each updated_property emit back to client and reflect in DB
      for(let i = 0; i < updated_properties.length; i++){
        let interactionChange = async () => {
          await updateDeviceInteraction(db, {
            sessionId: updated_properties[i].sessionId,
            device: updated_properties[i].deviceId,
            interaction: updated_properties[i].interaction,
            value: updated_properties[i].value,
          }, false);
          socket.emit('update-interaction', updated_properties[i]);
        }

        // Check if it is delayed
        if(updated_properties[i].delay == 0){
          await interactionChange(); 
        } else {
          setTimeout(interactionChange, updated_properties[i].delay * 1000); 
        }
      }

      // Handle explanations

      // External Engine

      devices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();



      // Save explanations from either external or internal

      // For each explanation emit back to client and reflect in DB
      if(explanations.length > 0){
        if(explanationConfig.explanation_trigger == 'automatic'){
          for(let i = 0; i < explanations.length; i++){
            let explanationGeneration = async () => {
              await db.collection('explanations').insertOne(explanations[i]);
              socket.emit('explanation', explanations[i]);
            }

            // Check if it is delayed
            if(explanations[i].delay == 0){
              await explanationGeneration(); 
            } else {
              setTimeout(explanationGeneration, explanations[i].delay * 1000);
            }
          }
        } else if(explanationConfig.explanation_trigger == 'on_demand'){
          let explanationCache = async () => {
            await db.collection('sessions').updateOne({ sessionId: data.sessionId }, { $set: { explanation_cache: explanations[explanations.length-1] } });
          }

          // Check if it is delayed
          if(explanations[explanations.length-1].delay == 0){
            await explanationCache(); 
          } else {
            setTimeout(explanationCache, explanations[explanations.length-1].delay * 1000);
          }
        }
      }

      // Check task goals


      let goalMet = false;


      for(let g = 0; g < taskDetail.goals.length; g++){
        let goal = taskDetail.goals[g];


        let deviceValues = searchDeviceAndProperty(goal.device, goal.condition.name, devices);
          // Check if the precondition is met
        if (deviceValues!== null) {
          switch (goal.condition.operator) {
            case '==':
              goalMet = deviceValues == goal.condition.value;
              break;
            case '!=':
              goalMet = deviceValues!= goal.condition.value;
              break;
            case '<':
              goalMet = deviceValues < goal.condition.value;
              break;
            case '>':
              goalMet = deviceValues > goal.condition.value;
              break;
            case '<=':
              goalMet = deviceValues <= goal.condition.value;
              break;
            case '>=':
              goalMet = deviceValues >= goal.condition.value;
              break;
            default:
              goalMet = false;
              break;
          }
        } else {
          goalMet = false;
        }

        // If one of the preconditions is not met, break the loop
        if(!goalMet){
          break;
        }
      }

      if(goalMet){
        // If the preconditions are met, execute the actions
        console.log('Task goal is met');
        // Update task in DB
        let taskDurationSec = (new Date() - currentTask.startTime) / 1000;

        logger.logTaskCompleted(currentTask.taskId);

        await db.collection('tasks').updateOne({ _id: currentTask._id }, { $set: { endTime: new Date(), completionTime: new Date(), isCompleted: true, duration: taskDurationSec } });

        // Update all subsequent tasks
        let taskOrder = currentTask.task_order;

        const subsequentTasks = await db.collection('tasks').find({
          userSessionId: data.sessionId,
          task_order: { $gt: taskOrder }
        }).toArray();

        let updatedProperties = [];

        if(subsequentTasks.length > 0){

      
          let startTimeSubsequent = new Date();
          let endTimeSubsequent = new Date();
          let individualTaskTimer;
          let globalTaskTimer = gameConfig.tasks.timer * 1000;
      
          let subsequentTask;
      
      
          for(let i = 0; i < subsequentTasks.length; i++) {
            if(i == 0){
              subsequentTask = subsequentTasks[i];
            }
            // Start time
            startTimeSubsequent = endTimeSubsequent;
            
            let taskDurationSubsequent = gameConfig.tasks.tasks.filter(task => task.id === subsequentTasks[i].taskId)[0].timer;
            if(taskDurationSubsequent !== undefined){
              individualTaskTimer = taskDurationSubsequent;
            } else {
              individualTaskTimer = globalTaskTimer;
            }
      
            endTimeSubsequent = new Date(startTimeSubsequent.getTime() + individualTaskTimer * 1000);
      
      
            await db.collection('tasks').updateOne(
              {
                userSessionId: data.sessionId,
                taskId: subsequentTasks[i].taskId
              },
              {
                $set: {
                  startTime: startTimeSubsequent,
                  endTime: endTimeSubsequent
                }
              }
            );
          }
      
          // Get default device properties of subsequent task
      
          let defaultDeviceProperty = gameConfig.tasks.tasks.filter(task => task.id === subsequentTask.taskId)[0].defaultDeviceProperties;
      
      
          for(let i = 0; i < defaultDeviceProperty.length; i++) {
            // Get current device property
            let currentDeviceProperty = await db.collection('devices').findOne({
              userSessionId: data.sessionId,
              deviceId: defaultDeviceProperty[i].device
            });
      
            for(let j = 0; j < currentDeviceProperty.deviceInteraction.length; j++){
              for(let k = 0; k < defaultDeviceProperty[i].properties.length; k++){
                if(currentDeviceProperty.deviceInteraction[j].name == defaultDeviceProperty[i].properties[k].name){
                  currentDeviceProperty.deviceInteraction[j].value = defaultDeviceProperty[i].properties[k].value;
                  updatedProperties.push({
                    device: defaultDeviceProperty[i].device,
                    interaction: currentDeviceProperty.deviceInteraction[j].name,
                    value: defaultDeviceProperty[i].properties[k].value
                  })
                }
              }
            }
      
            // Update in database
            await db.collection('devices').updateOne(
              {
                userSessionId: data.sessionId,
                deviceId: defaultDeviceProperty[i].device
              },
              {
                $set: {
                  deviceInteraction: currentDeviceProperty.deviceInteraction
                }
              }
            );
          }

          logger.logTaskBegin(subsequentTask.taskId);

        }
    
        // Add abortion options to updated tasks
        let updatedTasks = await db.collection('tasks').find({
          userSessionId: data.sessionId
        }).toArray();
    
        let globalAbortable = gameConfig.tasks.abortable ?? true;
    
        for(let i = 0; i < updatedTasks.length; i++) {
          let matchedTask = gameConfig.tasks.tasks.filter((task) => task.id === updatedTasks[i].taskId)[0];
          updatedTasks[i].abortionOptions = matchedTask.abortionOptions;
          updatedTasks[i].abortable = (matchedTask.abortable !== null) ? matchedTask.abortable : globalAbortable;
          updatedTasks[i].environment = (matchedTask.environment !== null) ? matchedTask.environment : [];
        }

        // Emit back to client
        socket.emit('game-update', {
          updatedTasks: updatedTasks,
          updatedProperties: updatedProperties,
          message: "You completed a task!",
          sessionId: data.sessionId,
        });

      }


    });

    socket.on('game-interaction', async (data) => {

      let userSession = await db.collection('sessions').findOne({ sessionId: data.sessionId });

      // Update socket id if necessary
      if(userSession.socketId != socket.id){
        // Update socketId
        await db.collection('sessions').updateOne({ sessionId: data.sessionId }, { $set: { socketId: socket.id } });
      }

      // Find the current task of the user
      let currentTime = new Date();

      let currentTask = await db.collection('tasks').findOne({ userSessionId: data.sessionId, startTime: { $lte: currentTime }, endTime: { $gte: currentTime } });
      
      if(!currentTask){
        return;
      }

      const metadataEngine = new Metadata(db, gameConfig, data.sessionId);
      await metadataEngine.loadUserData();

      const logger = new Logger(db, data.sessionId, metadataEngine, explanationEngine);

      await db.collection('tasks').updateOne({ userSessionId: data.sessionId, taskId: currentTask.taskId }, { $inc: { interactionTimes: 1 } });

      logger.logGameInteraction(data.type, data.data);

    });

    socket.on('task-timeout', async (data) => {
      const sessionId = data.sessionId;
      const taskId = data.taskId;

      if(!sessionId || !taskId){
        return;
      }

      const task = await db.collection('tasks').findOne({ userSessionId: sessionId, taskId: taskId });

      // Task duration
      const startTime = new Date(task.startTime);
      const endTime = new Date(task.endTime);
      // Calculate points based on task duration
      const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

      const currentTime = new Date().getTime()
      // Check if task is timed out using endTime
      if((endTime.getTime() - 1000) > currentTime || task.isCompleted || task.isTimedOut){
        return;
      }

      const metadataEngine = new Metadata(db, gameConfig, sessionId);
      await metadataEngine.loadUserData();

      const logger = new Logger(db, sessionId, metadataEngine, explanationEngine);

      logger.logTaskTimeout(taskId);

      const result = await db.collection('tasks').updateOne(
        { 
          userSessionId: sessionId,
          taskId: taskId,
          isTimedOut: false
        },
        {
          $set: {
            isTimedOut: true,
            endTime: new Date(),
            duration: durationSeconds
          }
        }
      );

      if(result.matchedCount == 0){
        return;
      }

      let task_order = task.task_order;

      // Get all subsequent tasks
      const subsequentTasks = await db.collection('tasks').find({
        userSessionId: sessionId,
        task_order: { $gt: task_order }
      }).toArray();
  
      let updatedProperties = [];

      if(subsequentTasks.length > 0){
        let startTimeSubsequent = new Date();
        let endTimeSubsequent = new Date();
        let individualTaskTimer;
        let globalTaskTimer = gameConfig.tasks.timer * 1000;
  
        let subsequentTask;

        for(let i = 0; i < subsequentTasks.length; i++) {
          if(i == 0){
            subsequentTask = subsequentTasks[i];
          }
          // Start time
          startTimeSubsequent = endTimeSubsequent;
          
          let taskDurationSubsequent = gameConfig.tasks.tasks.filter(task => task.id === subsequentTasks[i].taskId)[0].timer;
          if(taskDurationSubsequent != undefined || taskDurationSubsequent != 0){
            individualTaskTimer = taskDurationSubsequent;
          } else {
            individualTaskTimer = globalTaskTimer;
          }
  
          endTimeSubsequent = new Date(startTimeSubsequent.getTime() + individualTaskTimer * 1000);
  
  
          await db.collection('tasks').updateOne(
            {
              userSessionId: sessionId,
              taskId: subsequentTasks[i].taskId
            },
            {
              $set: {
                startTime: startTimeSubsequent,
                endTime: endTimeSubsequent
              }
            }
          );
        }
  
        // Get default device properties of subsequent task
  
        let defaultDeviceProperty = gameConfig.tasks.tasks.filter(task => task.id === subsequentTask.taskId)[0].defaultDeviceProperties;
  
  
        for(let i = 0; i < defaultDeviceProperty.length; i++) {
          // Get current device property
          let currentDeviceProperty = await db.collection('devices').findOne({
            userSessionId: sessionId,
            deviceId: defaultDeviceProperty[i].device
          });
  
          for(let j = 0; j < currentDeviceProperty.deviceInteraction.length; j++){
            for(let k = 0; k < defaultDeviceProperty[i].properties.length; k++){
              if(currentDeviceProperty.deviceInteraction[j].name == defaultDeviceProperty[i].properties[k].name){
                currentDeviceProperty.deviceInteraction[j].value = defaultDeviceProperty[i].properties[k].value;
                updatedProperties.push({
                  device: defaultDeviceProperty[i].device,
                  interaction: currentDeviceProperty.deviceInteraction[j].name,
                  value: defaultDeviceProperty[i].properties[k].value
                })
              }
            }
          }
  
          // Update in database
          await db.collection('devices').updateOne(
            {
              userSessionId: sessionId,
              deviceId: defaultDeviceProperty[i].device
            },
            {
              $set: {
                deviceInteraction: currentDeviceProperty.deviceInteraction
              }
            }
          );
        }

        logger.logTaskBegin(subsequentTask.taskId);

      }

      // Add abortion options to updated tasks
      let updatedTasks = await db.collection('tasks').find({
        userSessionId: sessionId
      }).toArray();

      let globalAbortable = gameConfig.tasks.abortable ?? true;

      for(let i = 0; i < updatedTasks.length; i++) {
        let matchedTasks = gameConfig.tasks.tasks.filter((task) => task.id === updatedTasks[i].taskId);
        updatedTasks[i].abortionOptions = matchedTasks[0].abortionOptions;
        
        updatedTasks[i].abortable = (matchedTasks[0].abortable !== null) ? matchedTasks[0].abortable : globalAbortable;

        updatedTasks[i].environment = (matchedTasks[0].environment !== null) ? matchedTasks[0].environment : [];

      }

      // Emit back to client
      socket.emit('game-update', {
        updatedTasks: updatedTasks,
        updatedProperties: updatedProperties,
        message: "You timed out a task!",
        sessionId: sessionId,
      });


    });

    socket.on('explanation_request', async (data) => {
      console.log('Explanation request received:', data);

      // Get explanation from explanation_cache
      let session = await db.collection('sessions').findOne({ sessionId: data.sessionId });

      if(session.socketId != socket.id){
        // Update socketId
        await db.collection('sessions').updateOne({ sessionId: data.sessionId }, { $set: { socketId: socket.id } });
      }

      let latestExplanation = session.explanation_cache;

      // Check if external explanation engine (REST) has explanation

      if(explanationConfig.explanation_engine == "external" && explanationConfig.external_engine_type.toLowerCase() == 'rest'){
        console.log('External explanation engine (REST)');

        let response = await fetch(explanationConfig.external_explanation_engine_api + '/explanation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: data.sessionId })
        });

        let responseData = await response.json();

        if(responseData['success'] && responseData['show_explanation']){
          let explanationText = responseData['explanation'];

          let currentTask = await db.collection('tasks').findOne({ userSessionId: data.sessionId, startTime: { $lte: new Date() }, endTime: { $gte: new Date() } });

          let currentTaskId = currentTask.taskId || '';

          latestExplanation = {
            'explanation': explanationText,
            'userSessionId': data.sessionId,
            'taskId': currentTaskId,
            'delay': 0
          }
        }
      }

      if(session.explanation_cache != null){

        latestExplanation.created_at = new Date();

        socket.emit('explanation', latestExplanation);

        await db.collection('explanations').insertOne(latestExplanation);

      } else {
        socket.emit('explanation', { explanation: "There is no explanation available, right now."});
        console.log('No explanation found in cache');
      }

    });

    socket.on('game-start', async (data) => {
      const sessionId = data.sessionId;

      if(!sessionId){
        return;
      }

      // Check if sessionId has logs
      const logs = await db.collection('logs').find({ user_session_id: sessionId }).toArray();

      if(logs.length > 0){
        return;
      }

      console.log('Game start received:', data);

      let currentTask = await db.collection('tasks').findOne({ userSessionId: sessionId, startTime: { $lte: new Date() }, endTime: { $gte: new Date() } });


      if(!currentTask){
        return;
      }

      const metadataEngine = new Metadata(db, gameConfig, sessionId);
      await metadataEngine.loadUserData();

      const logger = new Logger(db, sessionId, metadataEngine, explanationEngine);


      logger.logTaskBegin(currentTask.taskId);

    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});