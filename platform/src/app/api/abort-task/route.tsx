import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';

export async function POST(request: Request) {
  try {
    const { sessionId, taskId, abortedReason } = await request.json();

    if (!sessionId || !taskId || !abortedReason) {
      return NextResponse.json(
        { error: 'Session ID, Task ID and Abortion Options are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();

    const task = await db.collection('tasks').findOne({ userSessionId: sessionId, taskId: taskId });

    // Task duration
    const startTime = new Date(task.startTime);
    const endTime = new Date();
    // Calculate points based on task duration
    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

    // Find and update the task
    const result = await db.collection('tasks').updateOne(
      { 
        userSessionId: sessionId,
        taskId: taskId,
        isAborted: false // Only update if not already aborted
      },
      {
        $set: {
          isAborted: true,
          endTime: new Date(),
          abortedReason: abortedReason,
          duration: durationSeconds
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Task not found or already aborted' },
        { status: 404 }
      );
    }

    // Get task id of taskId
    let task_order = task.task_order;

    // Get all subsequent tasks
    const subsequentTasks = await db.collection('tasks').find({
      userSessionId: sessionId,
      task_order: { $gt: task_order }
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

    let updatedProperties = [];

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

    // Add abortion options to updated tasks
    let updatedTasks = await db.collection('tasks').find({
      userSessionId: sessionId
    }).toArray();

    let globalAbortable = gameConfig.tasks.abortable ?? true;

    for(let i = 0; i < updatedTasks.length; i++) {
      let matchedTasks = gameConfig.tasks.tasks.filter((task) => task.id === updatedTasks[i].taskId);
      updatedTasks[i].abortionOptions = matchedTasks[0].abortionOptions;
      
      updatedTasks[i].abortable = (matchedTasks[0].abortable !== null) ? matchedTasks[0].abortable : globalAbortable;
    }

    return NextResponse.json({
      success: true,
      message: 'Task aborted successfully',
      tasks: updatedTasks,
      updated_properties: updatedProperties
    });
  } catch (error) {
    console.error('Error aborting task:', error);
    return NextResponse.json(
      { error: 'Failed to abort task' },
      { status: 500 }
    );
  }
}