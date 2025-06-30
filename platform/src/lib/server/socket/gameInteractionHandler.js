import { validateSession, getCurrentTask, createLogger } from "../services/commonServices.js";

/**
 * Handle game interaction socket events
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleGameInteraction(socket, db, data, gameConfig, explanationEngine) {
    // Validate session
    const userSession = await validateSession(socket, db, data.sessionId);
    if (!userSession) return;

    // Get current task
    const currentTask = await getCurrentTask(db, data.sessionId);
    if (!currentTask) return;

    // Create logger
    const logger = await createLogger(db, data.sessionId, gameConfig, explanationEngine);

    // Update interaction counter
    await db.collection('tasks').updateOne(
        { userSessionId: data.sessionId, taskId: currentTask.taskId },
        { $inc: { interactionTimes: 1 } }
    );

    // Log game interaction
    await logger.logGameInteraction(data.type, data.data);
}