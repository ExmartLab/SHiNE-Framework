// src/lib/server/socket/explanationRequestHandler.js
import { validateSession, getCurrentTask } from "../services/commonServices.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * Handle explanation request socket events
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} explanationConfig - Explanation configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleExplanationRequest(socket, db, data, explanationConfig, explanationEngine) {
    console.log('Explanation request received:', data);

    // Validate session
    const userSession = await validateSession(socket, db, data.sessionId);
    if (!userSession) return;

    let latestExplanation = userSession.explanation_cache;

    // Check if external explanation engine (REST) has explanation
    if (explanationConfig.explanation_engine === "external" && explanationConfig.external_engine_type.toLowerCase() === 'rest') {
        console.log('External explanation engine (REST)');

        try {
            const response = await fetch(explanationConfig.external_explanation_engine_api + '/explanation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: data.sessionId })
            });

            const responseData = await response.json();

            if (responseData.success && responseData.show_explanation) {
                const explanationText = responseData.explanation;

                // Get current task
                const currentTask = await getCurrentTask(db, data.sessionId);
                const currentTaskId = currentTask?.taskId || '';

                latestExplanation = {
                    'explanation_id': uuidv4(),
                    'explanation': explanationText,
                    'userSessionId': data.sessionId,
                    'taskId': currentTaskId,
                    'delay': 0
                };
            }
        } catch (error) {
            console.error('Error fetching explanation from external engine:', error);
        }
    }

    if (latestExplanation) {
        // Update creation time
        latestExplanation.created_at = new Date();

        let rating = null;
        if(explanationConfig.explanation_rating == 'like') {
            rating = 'like';
        }

        // Send explanation to client
        socket.emit('explanation', { explanation: latestExplanation.explanation, explanation_id: latestExplanation.explanation_id, rating: rating});

        // Save explanation to database
        await db.collection('explanations').insertOne(latestExplanation);
    } else {
        // No explanation available
        socket.emit('explanation', {
            explanation: "There is no explanation available right now."
        });
        console.log('No explanation found in cache');
    }
}