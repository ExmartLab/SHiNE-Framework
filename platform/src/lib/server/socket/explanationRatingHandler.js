import { validateSession, getCurrentTask } from "../services/commonServices.js";

/**
 * Handle explanation rating event
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleExplanationRating(socket, db, data) {
    // Validate session
    const userSession = await validateSession(socket, db, data.sessionId);
    if (!userSession) return;

    // Get current task
    const currentTask = await getCurrentTask(db, data.sessionId);
    if (!currentTask) return;

    // Find explanation id in database 'explanations' collection abd add rating to it

    await db.collection('explanations').updateOne({
        explanation_id: data.explanation_id,
        userSessionId: data.sessionId
    }, {
        $set: {
            rating: data.rating
        }
    });
    
}