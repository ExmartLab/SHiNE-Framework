// src/lib/server/socket/taskTimeoutHandler.js
import {
    validateSession,
    createLogger,
    updateSubsequentTasks,
    getUpdatedTasksWithMetadata
} from "../services/commonServices.js";

/**
 * Handle task timeout socket events
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleTaskTimeout(socket, db, data, gameConfig, explanationEngine) {
    const { sessionId, taskId } = data;
    if (!sessionId || !taskId) return;

    // Validate session
    const userSession = await validateSession(socket, db, sessionId);
    if (!userSession) return;

    // Get the task
    const task = await db.collection('tasks').findOne({ userSessionId: sessionId, taskId });
    if (!task) return;

    // Calculate task duration
    const startTime = new Date(task.startTime);
    const endTime = new Date();
    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

    // Verify task is truly timing out
    const currentTime = new Date().getTime();
    if ((endTime.getTime() - 1000) > currentTime || task.isCompleted || task.isTimedOut) {
        return;
    }

    // Create logger
    const logger = await createLogger(db, sessionId, gameConfig, explanationEngine);

    // Log task timeout
    await logger.logTaskTimeout(taskId);

    // Update task as timed out
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

    if (result.matchedCount === 0) {
        return;
    }

    // Update subsequent tasks
    const { subsequentTask, updatedProperties } = await updateSubsequentTasks(
        db,
        sessionId,
        task.task_order,
        gameConfig
    );

    // Log beginning of next task if exists
    if (subsequentTask) {
        await logger.logTaskBegin(subsequentTask.taskId);
    }

    // Get updated tasks with metadata
    const updatedTasks = await getUpdatedTasksWithMetadata(db, sessionId, gameConfig);

    // Emit game update to client
    socket.emit('game-update', {
        updatedTasks,
        updatedProperties,
        sessionId
    });
}