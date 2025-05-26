// src/lib/server/explanation_engine/index.js
import WebSocketExplanationEngine from "./websocket.js";
import RestExplanationEngine from "./rest.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * Set up and configure the appropriate explanation engine based on config
 * @param {Object} db - MongoDB database connection
 * @param {Object} config - Explanation engine configuration
 * @returns {Object|null} - Configured explanation engine or null
 */
export async function setupExplanationEngine(db, config) {
  if (config.explanation_engine !== "external") {
    return null;
  }

  const explanationCallback = async (data) => {
    // Get socket ID from DB
    const userData = await db.collection('sessions').findOne({ sessionId: data.user_id });
    if (!userData) return;

    // Get current user task id
    const currentTask = await db.collection('tasks').findOne({ 
      userSessionId: data.user_id, 
      startTime: { $lte: new Date() }, 
      endTime: { $gte: new Date() } 
    });

    const currentTaskId = currentTask?.taskId || '';

    const explanation = {
      'explanation_id': uuidv4(),
      'explanation': data.explanation,
      'created_at': new Date(),
      'userSessionId': userData.sessionId,
      'taskId': currentTaskId,
      'delay': 0
    };

    let enforcedAutomaticExplanation = false;
    if (data.enforce_automatic_explanation != null && data.enforce_automatic_explanation === true) {
      enforcedAutomaticExplanation = true;
    }
      
    if (config.explanation_trigger === 'on_demand' && !enforcedAutomaticExplanation) {
      await db.collection('sessions').updateOne(
        { sessionId: userData.sessionId }, 
        { $set: { explanation_cache: explanation } }
      );
    } else if (config.explanation_trigger === 'automatic' || enforcedAutomaticExplanation) {
      await db.collection('explanations').insertOne(explanation);
      const socketId = userData.socketId;
      if (socketId) {
        const io = global.io; // Get the global io instance

        let rating = null;
        if(config.explanation_rating == 'like') {
          rating = 'like';
        }

        io.to(socketId).emit('explanation', { explanation: data.explanation, explanation_id: explanation.explanation_id, rating: rating });
      }
    }
  };

  if (config.external_engine_type === 'ws') {
    return new WebSocketExplanationEngine(
      config.external_explanation_engine_api, 
      explanationCallback
    );
  } else if (config.external_engine_type === 'rest') {
    return new RestExplanationEngine(
      config.external_explanation_engine_api, 
      explanationCallback
    );
  }
  
  return null;
}