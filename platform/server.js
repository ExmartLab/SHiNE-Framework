import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { connectToDatabase } from "./src/lib/mongodb.js";
import { updateDeviceInteraction } from "./src/lib/deviceInteractions.js";
import { searchDeviceAndProperty } from "./src/lib/deviceUtils.js";
import gameConfig from "./src/game.json" assert { type: "json" };
import explanationConfig from "./src/explanation.json" assert { type: "json" };

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

  io.on("connection", (socket) => {
    console.log('New client connected:', socket.id);
    
    // Listen for device_interaction events
    socket.on('device-interaction', async (data) => {
      console.log('Device interaction received:', data);

      // Update device interaction in DB using the dedicated function
      await updateDeviceInteraction(db, data);

      // console.log()

      // Get all devices from DB
      let devices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();


      // console.log(searchDeviceAndProperty('deep_fryer', 'Power', devices));

      let currentTime = new Date();

      // Find the current task of the user
      let currentTask = await db.collection('tasks').findOne({ userSessionId: data.sessionId, startTime: { $lte: currentTime }, endTime: { $gte: currentTime } });

      let taskDetail = gameConfig.tasks.tasks.filter((task) => task.id == currentTask.taskId)[0];


      let updated_properties = [];
      let explanations = [];

      for(let i = 0; i < taskDetail.rules.length; i++){
        console.log(taskDetail.rules[i]);

        let preconditionsMet = false;

        // Check for each rule whether the preconditions apply
        for(let p = 0; p < taskDetail.rules[i].precondition.length; p++){
          let precondition = taskDetail.rules[i].precondition[p];


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
          }

          // If one of the preconditions is not met, break the loop
          if(!preconditionsMet){
            break;
          }
        }

        if(preconditionsMet){
          // If the preconditions are met, execute the actions
          for(let a = 0; a < taskDetail.rules[i].action.length; a++){
            console.log(taskDetail.rules[i].action[a]);
            if(taskDetail.rules[i].action[a].type == "Device_Interaction"){
              updated_properties.push({
                sessionId: data.sessionId,
                deviceId: taskDetail.rules[i].action[a].device,
                interaction: taskDetail.rules[i].action[a].interaction.name,
                value: taskDetail.rules[i].action[a].interaction.value,
              });
            } else if(taskDetail.rules[i].action[a].type == "Explanation" && explanationConfig.explanation_engine == "integrated"){
              explanations.push({
                'explanation': explanationConfig.integrated_explanation_engine[taskDetail.rules[i].action[a].explanation],
                'created_at': new Date(),
                'userSessionId': data.sessionId,
                'taskId': currentTask.taskId,
              });
            }
          }
        }
      }

      console.log(updated_properties);

      // Change in DB

      // For each updated_property emit back to client and reflect in DB
      for(let i = 0; i < updated_properties.length; i++){
        await updateDeviceInteraction(db, {
          sessionId: updated_properties[i].sessionId,
          device: updated_properties[i].deviceId,
          interaction: updated_properties[i].interaction,
          value: updated_properties[i].value,
        });
        socket.emit('update-interaction', updated_properties[i]);
      }

      // For each explanation emit back to client and reflect in DB
      for(let i = 0; i < explanations.length; i++){
        await db.collection('explanations').insertOne(explanations[i]);
        socket.emit('explanation', explanations[i]);
      }


      // Check task goals

      devices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();

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

        await db.collection('tasks').updateOne({ _id: currentTask._id }, { $set: { endTime: new Date(), completionTime: new Date(), isCompleted: true, duration: taskDurationSec } });

        // Update all subsequent tasks
        let taskOrder = currentTask.task_order;

        const subsequentTasks = await db.collection('tasks').find({
          userSessionId: data.sessionId,
          task_order: { $gt: taskOrder }
        }).toArray();
    
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
    
        let updatedProperties = [];
    
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
    
        // Add abortion options to updated tasks
        let updatedTasks = await db.collection('tasks').find({
          userSessionId: data.sessionId
        }).toArray();
    
    
        for(let i = 0; i < updatedTasks.length; i++) {
          let matchedTask = gameConfig.tasks.tasks.filter((task) => task.id === updatedTasks[i].taskId)[0];
          updatedTasks[i].abortionOptions = matchedTask.abortionOptions;
          updatedTasks[i].abortable = (matchedTask.abortable !== null && matchedTask.abortable == false) ? false : true;
        }

        // Emit back to client
        socket.emit('task-update', {
          updatedTasks: updatedTasks,
          updatedProperties: updatedProperties,
          message: "You completed a task!",
          sessionId: data.sessionId,
        });

      }


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