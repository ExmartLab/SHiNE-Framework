/**
 * API Route: Game Data
 * 
 * Retrieves and prepares game configuration data for a specific study session.
 * Merges current device states, task information, and configuration settings
 * to provide the frontend with complete game state for rendering.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';
import explanationConfig from '@/explanation.json';

/**
 * GET /api/game-data
 * 
 * Fetches game configuration and current state for a study session including:
 * - Updated game configuration with current device states
 * - Task list with timing and environment variables
 * - Explanation system configuration
 * - Game timing information synchronized with session start
 * 
 * @param request - HTTP request with sessionId as query parameter
 * @returns JSON response containing gameConfig and tasks for the session
 */
export async function GET(request: Request) {
  try {
    // Extract session identifier from URL parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Verify session exists and is still active
    const session = await db.collection('sessions').findOne({ sessionId });
    if (!session || session.isCompleted) {
      return NextResponse.json(
        { error: 'Session not found or already completed', session_completed: session?.isCompleted },
        { status: 404 }
      );
    }

    // Fetch all session-related data concurrently for efficiency
    const [devices, tasks, userData] = await Promise.all([
      db.collection('devices').find({ userSessionId: sessionId }).toArray(),
      db.collection('tasks').find({ userSessionId: sessionId }).toArray(),
      db.collection('sessions').find({ sessionId: sessionId }).toArray()
    ]);

    /**
     * Task State Reconciliation Section
     * Check for and fix expired tasks that weren't properly timed out
     * This handles cases where users closed their browser and returned later
     */
    const currentTime = new Date();
    let tasksUpdated = false;

    // Find any tasks that should have timed out but haven't been marked
    const expiredTasks = tasks.filter(task => {
      const taskEndTime = new Date(task.endTime);
      return currentTime > taskEndTime &&
             !task.isCompleted &&
             !task.isTimedOut &&
             !task.isAborted;
    });

    // Mark expired tasks as timed out and recalculate subsequent task timing
    if (expiredTasks.length > 0) {
      // Import required functions
      const { updateSubsequentTasks, createLogger } = await import('@/lib/server/services/commonServices.js');

      // Create logger for proper device property update notifications
      const logger = await createLogger(db, sessionId, gameConfig, null);

      // Sort expired tasks by task_order to process them in sequence
      expiredTasks.sort((a, b) => a.task_order - b.task_order);

      for (const expiredTask of expiredTasks) {
        // Mark task as timed out
        const taskDurationSec = (expiredTask.endTime.getTime() - expiredTask.startTime.getTime()) / 1000;

        await db.collection('tasks').updateOne(
          { _id: expiredTask._id },
          {
            $set: {
              isTimedOut: true,
              duration: taskDurationSec
            }
          }
        );

        // Update the local task object for consistent return data
        expiredTask.isTimedOut = true;
        expiredTask.duration = taskDurationSec;

        // Log task timeout for consistency
        await logger.logTaskTimeout(expiredTask.taskId);

        // Update subsequent tasks timing and device properties
        await updateSubsequentTasks(db, sessionId, expiredTask.task_order, gameConfig, logger);
        tasksUpdated = true;
      }

      // If we updated tasks, refetch both tasks and devices to get the corrected data
      if (tasksUpdated) {
        const [updatedTasks, updatedDevices] = await Promise.all([
          db.collection('tasks').find({ userSessionId: sessionId }).toArray(),
          db.collection('devices').find({ userSessionId: sessionId }).toArray()
        ]);
        tasks.splice(0, tasks.length, ...updatedTasks);
        devices.splice(0, devices.length, ...updatedDevices);
      }
    }


    /**
     * Game Configuration Update Section
     * Merges current device states from database with base game configuration
     */
    const updatedGameConfig = JSON.parse(JSON.stringify(gameConfig));

    // Update device states with current values from database
    for (const device of devices) {
      // Navigate through the hierarchical room/wall/device structure
      for (const room of updatedGameConfig.rooms) {
        for (const wall of room.walls) {
          if (!wall.devices) continue;
          
          const gameDevice = wall.devices.find(d => d.id === device.deviceId);
          if (gameDevice) {
            // Sync each device interaction with current database state
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

    /**
     * Task Configuration Enhancement
     * Adds abort options, environment variables, and configuration flags
     */
    const globalAbortable = gameConfig.tasks.abortable ?? true;

    for(let i = 0; i < tasks.length; i++){
      const taskId = tasks[i].taskId;
      // Match task with configuration to get additional properties
      const matchedTask = gameConfig.tasks.tasks.filter((task) => task.id == taskId);
      tasks[i]['abortionOptions'] = matchedTask[0].abortionOptions;
      tasks[i]['abortable'] = (matchedTask[0].abortable !== null) ? matchedTask[0].abortable : globalAbortable;
      tasks[i]['environment'] = (matchedTask[0].environment !== null) ? matchedTask[0].environment : [];
    }

    // Remove task configurations from game config (sent separately)
    updatedGameConfig.tasks = null;

    /**
     * Explanation System Configuration
     * Adds explanation settings to game configuration
     */
    updatedGameConfig['explanation'] = {};
    updatedGameConfig['explanation']['explanation_trigger'] = explanationConfig.explanation_trigger;

    /**
     * Game Timing Synchronization
     * Sets game start time based on actual session start for accurate timing
     */
    const startTimeUnix = new Date(userData[0].startTime).getTime();
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