import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { connectToDatabase } from "./src/lib/mongodb.js";
import { updateDeviceInteraction } from "./src/lib/deviceInteractions.js";
import gameConfig from "./src/game.json" assert { type: "json" };

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

      // Get all devices from DB
      const devices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();

      function searchDeviceAndProperty(device, property, devices) {
        for (let i = 0; i < devices.length; i++) {
          if (devices[i].deviceId === device) {
            for (let j = 0; j < devices[i].deviceInteraction.length; j++) {
              if (devices[i].deviceInteraction[j].name === property) {
                return devices[i].deviceInteraction[j].value;
              }
            }
          }
        }
        return null;
      }

      // console.log(searchDeviceAndProperty('deep_fryer', 'Power', devices));

      let currentTime = new Date();

      // Find the current task of the user
      let currentTask = await db.collection('tasks').findOne({ userSessionId: data.sessionId, startTime: { $lte: currentTime }, endTime: { $gte: currentTime } });

      let taskDetail = gameConfig.tasks.tasks.filter((task) => task.id == currentTask.taskId)[0];
      // console.log(taskDetail);
      console.log(taskDetail.rules.length);

      let updated_properties = [];

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
              console.log(`Precondition check: ${device}.${property} ${operator} ${value} = ${preconditionsMet}`);
            } else {
              console.log(`Device value not found for ${device}.${property}`);
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
            updated_properties.push({
              sessionId: data.sessionId,
              deviceId: taskDetail.rules[i].action[a].device,
              interaction: taskDetail.rules[i].action[a].interaction.name,
              value: taskDetail.rules[i].action[a].interaction.value,
            })
          }
        }
      }

      console.log(updated_properties);

      // Change in DB

      // For each updated_property emit back to client
      for(let i = 0; i < updated_properties.length; i++){
        socket.emit('update-interaction', updated_properties[i]);
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