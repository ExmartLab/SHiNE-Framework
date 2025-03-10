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

    let taskDurationSubsequent;
    let startTimeSubsequent = new Date();
    let endTimeSubsequent = new Date();
    let individualTaskTimer;
    let globalTaskTimer = gameConfig.tasks.timer * 1000;


    for(let i = 0; i < subsequentTasks.length; i++) {
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


    let updatedTasks = await db.collection('tasks').find({
      userSessionId: sessionId
    }).toArray();


    for(let i = 0; i < updatedTasks.length; i++) {
      updatedTasks[i].abortionOptions = gameConfig.tasks.tasks.filter((task) => task.id === updatedTasks[i].taskId)[0].abortionOptions;
    }

    return NextResponse.json({
      success: true,
      message: 'Task aborted successfully',
      tasks: updatedTasks
    });
  } catch (error) {
    console.error('Error aborting task:', error);
    return NextResponse.json(
      { error: 'Failed to abort task' },
      { status: 500 }
    );
  }
}