import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';
import { start } from 'node:repl';

export async function GET(request: Request) {
  try {
    


    let tasks:any = [];

    let tasksConfig = gameConfig.tasks.tasks;

    let task = null;
    let startTime = new Date();
    let endTime = new Date();
    let individualTaskTimer = 0;
    let globalTaskTimer = gameConfig.tasks.timer * 1000;
    let taskId = null;
    let taskDescription = null;

    for (let i = 0; i < tasksConfig.length; i++) {
        task = tasksConfig[i];
        taskId = task.id;
        taskDescription = task.description;

        if(task.timer != undefined || task.timer != 0){
            individualTaskTimer = task.timer * 1000;
        } else {
            individualTaskTimer = globalTaskTimer;
        }
    

        endTime = new Date(endTime.getTime() + individualTaskTimer);



        let taskData = {
            taskId,
            task_order: i,
            taskDescription,
            isCompleted: false,
            isAborted: false,
            completionTime: null,
            abortedReason: null,
            startTime: startTime,
            lastActivity: endTime,
            interactionTimes: 0,
        };

        startTime = endTime;

        tasks.push(taskData);
    }

    if(!tasks.ordered && tasks.ordered == false){
        tasks = tasks.sort(() => Math.random() - 0.5);
    }





    return NextResponse.json({
      success: true,
      message: 'Session created successfully',
      tasks
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}