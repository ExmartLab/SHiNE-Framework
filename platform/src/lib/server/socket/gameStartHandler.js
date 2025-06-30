import { validateSession, getCurrentTask, createLogger } from "../services/commonServices.js";

/**
 * Handle game start socket events
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleGameStart(socket, db, data, gameConfig, explanationEngine) {
    const { sessionId } = data;
    if (!sessionId) return;

    // Validate session
    const userSession = await validateSession(socket, db, sessionId);
    if (!userSession) return;

    // Check if sessionId has logs (to prevent duplicate game start)
    const logs = await db.collection('logs').find({ user_session_id: sessionId }).toArray();
    if (logs.length > 0) {
        return;
    }

    // Get current task
    const currentTask = await getCurrentTask(db, sessionId);
    if (!currentTask) return;

    // Create logger
    const logger = await createLogger(db, sessionId, gameConfig, explanationEngine);

    // Log task begin
    await logger.logTaskBegin(currentTask.taskId);
}