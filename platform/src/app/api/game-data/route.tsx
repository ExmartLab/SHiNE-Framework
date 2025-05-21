import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';
import explanationConfig from '@/explanation.json';

export async function GET(request: Request) {
  try {
    // Get sessionId from the URL search params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();

    // Check if session is completed
    const session = await db.collection('sessions').findOne({ sessionId });
    if (!session || session.isCompleted) {
      return NextResponse.json(
        { error: 'Session not found or already completed', session_completed: session?.isCompleted },
        { status: 404 }
      );
    }

    // Find devices and tasks for the given session
    const [devices, tasks, userData] = await Promise.all([
      db.collection('devices').find({ userSessionId: sessionId }).toArray(),
      db.collection('tasks').find({ userSessionId: sessionId }).toArray(),
      db.collection('sessions').find({ sessionId: sessionId }).toArray()
    ]);


    // Create a deep copy of gameConfig to avoid modifying the original
    const updatedGameConfig = JSON.parse(JSON.stringify(gameConfig));

    // Update device states in the game configuration
    for (const device of devices) {
      // Find the device in the game configuration
      for (const room of updatedGameConfig.rooms) {
        for (const wall of room.walls) {
          if (!wall.devices) continue;
          
          const gameDevice = wall.devices.find(d => d.id === device.deviceId);
          if (gameDevice) {
            // Update each interaction's current state
            for (const interaction of device.deviceInteraction) {
              const gameInteraction = gameDevice.interactions.find(i => i.name === interaction.name);
              if (gameInteraction) {
                gameInteraction.currentState = {
                  ...gameInteraction.currentState,
                  value: interaction.value
                };
              }
            }
          }
        }
      }
    }

    let globalAbortable = gameConfig.tasks.abortable ?? true;

    for(let i = 0; i < tasks.length; i++){
      let taskId = tasks[i].taskId;
      // Find taskId in gameConfig.tasks.tasks array using id
      let matchedTask = gameConfig.tasks.tasks.filter((task) => task.id == taskId);
      tasks[i]['abortionOptions'] = matchedTask[0].abortionOptions;
      tasks[i]['abortable'] = (matchedTask[0].abortable !== null) ? matchedTask[0].abortable : globalAbortable;

      tasks[i]['environment'] = (matchedTask[0].environment !== null) ? matchedTask[0].environment : [];
    }

    // remove tasks from gameCOnfig
    updatedGameConfig.tasks = null;

    updatedGameConfig['explanation'] = {};
    
    updatedGameConfig['explanation']['explanation_trigger'] = explanationConfig.explanation_trigger;

    updatedGameConfig['explanation']['allow_user_message'] = explanationConfig.allow_user_message ?? false;

    // Game start time
    

    // Get start time of user
    let startTimeUnix = new Date(userData[0].startTime).getTime();

    updatedGameConfig['environment']['time']['gameStart'] = startTimeUnix;

    return NextResponse.json({
      success: true,
      message: 'Game data retrieved successfully',
      gameConfig: updatedGameConfig,
      tasks
    });
  } catch (error){
    console.error('Error retrieving game data:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}