/**
 * API Route: Create Study Session
 * 
 * Creates a new study session with associated tasks and device configurations.
 * Initializes the complete study environment including task scheduling,
 * device states, and participant data based on the game configuration.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';

/**
 * POST /api/create-session
 * 
 * Creates a new study session for a participant including:
 * - Session record with participant metadata
 * - Scheduled tasks with timing and descriptions
 * - Device configurations and initial states
 * - Default device properties for the first task
 * 
 * @param request - HTTP request containing session data and custom participant data
 * @returns JSON response with session creation status
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, custom_data } = body;

    // Validate required fields from the request
    if (!sessionId || !custom_data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Prevent duplicate sessions for the same participant
    const existingSession = await db
      .collection('sessions')
      .findOne({ sessionId, isCompleted: false });

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
    
    // Create new session record with participant metadata
    await db.collection('sessions').insertOne({
      sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      userAgent: body.userAgent || null,
      screenSize: body.screenSize || null,
      isCompleted: false,
      completionTime: null,
      customData: custom_data || {},
      explanation_cache: null,
      socketId: null,
    });

    /**
     * Task Creation Section
     * Creates scheduled tasks based on game configuration with proper timing
     */

    let tasks:any = [];
    const tasksConfig = gameConfig.tasks.tasks;

    let task = null;
    let startTime = new Date();
    let endTime = new Date();
    let individualTaskTimer = 0;
    const globalTaskTimer = gameConfig.tasks.timer;
    let taskId = null;
    let taskDescription = null;

    // Generate tasks with sequential timing
    for (let i = 0; i < tasksConfig.length; i++) {
        task = tasksConfig[i];
        taskId = task.id;
        taskDescription = task.description;

        // Use task-specific timer or fall back to global timer
        if(task.timer !== undefined){
            individualTaskTimer = task.timer;
        } else {
            individualTaskTimer = globalTaskTimer;
        }

        // Calculate task end time based on duration
        endTime = new Date(endTime.getTime() + individualTaskTimer * 1000);

        const taskData = {
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

        // Next task starts when current task ends
        startTime = endTime;
        tasks.push(taskData);
    }

    // Randomize task order if not specified as ordered
    if(!tasks.ordered && tasks.ordered == false){
        tasks = tasks.sort(() => Math.random() - 0.5);
        // Reset sequential order indices after randomization
        for (let i = 0; i < tasks.length; i++) {
            tasks[i].task_order = i;
        }
    }

    // Insert all tasks into database
    await db.collection('tasks').insertMany(tasks);


    /**
     * Device Creation Section
     * Extracts and initializes all devices from the game configuration
     */
    
    const devices = [];
    const rooms = gameConfig.rooms;
    let walls = null;

    // Extract all devices hierarchically from rooms -> walls -> devices
    for(let i = 0; i < rooms.length; i++){
      walls = rooms[i].walls;
      for(let j = 0; j < walls.length; j++){
        const deviceArr = walls[j].devices;
        if(deviceArr == undefined)
            continue;
        for(let k = 0; k < deviceArr.length; k++){
          devices.push(deviceArr[k]);
        }
      }
    }

    const userDevice = [];
    let deviceInteraction = [];

    // Create user-specific device records with initial interaction states
    for( let i = 0; i < devices.length; i++){
        deviceInteraction = [];

        // Extract interaction configurations for each device
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

    // Insert device records into database
    if(userDevice.length > 0)
      await db.collection('devices').insertMany(userDevice);

    /**
     * Default Device Properties Setup
     * Applies initial device states for the first task
     */

    const firstTask = tasks[0];
    const defaultDeviceProperty = gameConfig.tasks.tasks.filter(task => task.id === firstTask.taskId)[0].defaultDeviceProperties;

    // Update device properties to match first task requirements
    for(let i = 0; i < defaultDeviceProperty.length; i++) {
      // Retrieve current device record
      const currentDeviceProperty = await db.collection('devices').findOne({
        userSessionId: sessionId,
        deviceId: defaultDeviceProperty[i].device
      });

      // Update interaction values based on task defaults
      for(let j = 0; j < currentDeviceProperty.deviceInteraction.length; j++){
        for(let k = 0; k < defaultDeviceProperty[i].properties.length; k++){
          if(currentDeviceProperty.deviceInteraction[j].name == defaultDeviceProperty[i].properties[k].name){
            currentDeviceProperty.deviceInteraction[j].value = defaultDeviceProperty[i].properties[k].value;
          }
        }
      }

      // Save updated device state to database
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