import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, participantId, custom_data } = body;

    // Validate required fields
    if (!participantId || !sessionId || !custom_data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();

    // Check if participant already has a session
    const existingSession = await db
      .collection('sessions')
      .findOne({ participantId, isCompleted: false });

    if (existingSession) {
      return NextResponse.json(
        { 
          error: 'Participant already has an active session',
          existingSessionId: existingSession.sessionId,
          currentScenario: existingSession.currentScenario
        },
        { status: 409 }
      );
    }
    
    // Create new session
    await db.collection('sessions').insertOne({
      sessionId,
      participantId,
      startTime: new Date(),
      lastActivity: new Date(),
      userAgent: body.userAgent || null,
      screenSize: body.screenSize || null,
      isCompleted: false,
      customData: custom_data || {},
      explanation_cache: null
    });

    // Create tasks


    let tasks:any = [];

    let tasksConfig = gameConfig.tasks.tasks;

    let task = null;
    let startTime = new Date();
    let endTime = new Date();
    let individualTaskTimer = 0;
    let globalTaskTimer = gameConfig.tasks.timer;
    let taskId = null;
    let taskDescription = null;

    for (let i = 0; i < tasksConfig.length; i++) {
        task = tasksConfig[i];
        taskId = task.id;
        taskDescription = task.description;

        if(task.timer !== undefined){
            individualTaskTimer = task.timer;
        } else {
            individualTaskTimer = globalTaskTimer;
        }
    

        endTime = new Date(endTime.getTime() + individualTaskTimer * 1000);

        let taskData = {
            userSessionId: sessionId,
            taskId,
            task_order: i,
            taskDescription,
            isCompleted: false,
            isAborted: false,
            isTimedOut: false,
            completionTime: null,
            abortedReason: null,
            startTime: startTime,
            endTime: endTime,
            interactionTimes: 0,
        };

        startTime = endTime;

        tasks.push(taskData);
    }

    if(!tasks.ordered && tasks.ordered == false){
        // Randomize tasks using task_order
        tasks = tasks.sort(() => Math.random() - 0.5);
        // Reset task_order
        for (let i = 0; i < tasks.length; i++) {
            tasks[i].task_order = i;
        }
    }

    // Create tasks
    await db.collection('tasks').insertMany(tasks);


    // Create devices

    
    let devices = [];

    let rooms = gameConfig.rooms;
    let walls = null;

    // Retrieve all devices hierarchically from all walls

    for(let i = 0; i < rooms.length; i++){
      walls = rooms[i].walls;
      for(let j = 0; j < walls.length; j++){
        let deviceArr = walls[j].devices;
        if(deviceArr == undefined)
            continue;
        for(let k = 0; k < deviceArr.length; k++){
          devices.push(deviceArr[k]);
        }
      }
    }

    let userDevice = [];

    let deviceInteraction = [];

    for( let i = 0; i < devices.length; i++){
        deviceInteraction = [];

        for(let j = 0; j < devices[i].interactions.length; j++){

            deviceInteraction.push({
                name: devices[i].interactions[j].name,
                type: devices[i].interactions[j].InteractionType,
                value: devices[i].interactions[j].currentState.value
            });
        }
      
        userDevice.push({
            userSessionId: sessionId,
            deviceId: devices[i].id,
            deviceInteraction: deviceInteraction
        });

    }

    // Create user devices
    await db.collection('devices').insertMany(userDevice);

    return NextResponse.json({
      success: true,
      message: 'Session created successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}