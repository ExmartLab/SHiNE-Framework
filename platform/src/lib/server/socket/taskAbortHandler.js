import {
    validateSession,
    createLogger,
    updateSubsequentTasks,
    getUpdatedTasksWithMetadata
} from "../services/commonServices.js";

/**
 * Handle task abort socket events
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleTaskAbort(socket, db, data, gameConfig, explanationEngine) {
    const { sessionId, taskId, abortOption } = data;
    if (!sessionId || !taskId || !abortOption) return;

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

    // Create logger
    const logger = await createLogger(db, sessionId, gameConfig, explanationEngine);

    // Log task abort
    await logger.logTaskAbort(taskId, abortOption);

    // Update task as aborted
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
                abortedReason: abortOption,
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
        gameConfig,
        logger
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
        message: "You aborted a task!",
        sessionId
    });
}