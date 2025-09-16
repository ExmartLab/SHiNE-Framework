/**
 * @fileoverview Factory module for configuring explanation engines in the V-SHINE Study Platform.
 * 
 * This module provides a factory function that sets up explanation engines based on configuration.
 * It supports both WebSocket and REST-based external explanation engines, with configurable
 * triggers (pull vs push vs interactive) and rating systems.
 * 
 * The explanation engine integrates with the main study platform to provide AI-generated
 * explanations for user interactions with smart home devices during research studies.
 */

// External dependencies
import WebSocketExplanationEngine from "./websocket.js";
import RestExplanationEngine from "./rest.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * Factory function to set up and configure the appropriate explanation engine based on configuration.
 * 
 * Creates explanation engines that can operate in three modes:
 * - Pull: Explanations are cached and delivered when requested by the user
 * - Push: Explanations are delivered immediately when triggered by system events
 * - Interactive: Explanations are delivered immediately + enables user messages to external engine
 * 
 * @param {Object} db - MongoDB database connection for storing explanations and session data
 * @param {Object} config - Explanation engine configuration object containing:
 *   - explanation_engine: String indicating if external engine should be used
 *   - external_explanation_engine: Object containing external engine configuration:
 *     - external_engine_type: Type of engine ('ws' for WebSocket, 'rest' for REST API)
 *     - external_explanation_engine_api: URL of the external explanation service
 *   - explanation_trigger: Trigger mode ('pull', 'push', or 'interactive')
 *   - explanation_rating: Rating system type ('like' or other)
 * @returns {Object|null} Configured explanation engine instance or null if not configured
 */
export async function setupExplanationEngine(db, config) {
  // Early return if external explanation engine is not configured
  if (config.explanation_engine !== "external") {
    return null;
  }

  /**
   * Callback function that processes explanation data received from external engines.
   * 
   * This function handles the complete workflow of explanation processing:
   * 1. Validates user session and retrieves session data
   * 2. Identifies the current active task for context
   * 3. Creates explanation record with metadata
   * 4. Routes explanation based on trigger configuration (pull vs push vs interactive)
   * 5. Delivers explanation to client via WebSocket if push or interactive
   * 
   * @param {Object} data - Explanation data from external engine containing:
   *   - user_id: Session ID of the user requesting explanation
   *   - explanation: Generated explanation text
   */
  const explanationCallback = async (data) => {
    // Validate user session and retrieve session data from database
    const userData = await db.collection('sessions').findOne({ sessionId: data.user_id });
    if (!userData) return;

    // Find the currently active task for this user to provide context
    const currentTask = await db.collection('tasks').findOne({
      userSessionId: data.user_id,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
      isCompleted: { $ne: true },
      isTimedOut: { $ne: true },
      isAborted: { $ne: true }
    });

    const currentTaskId = currentTask?.taskId || '';

    // Create explanation record with metadata for storage and tracking
    const explanation = {
      'explanation_id': uuidv4(),
      'explanation': data.explanation,
      'created_at': new Date(),
      'userSessionId': userData.sessionId,
      'taskId': currentTaskId,
      'delay': 0
    };

    // Handle explanation routing based on trigger configuration
    if (config.explanation_trigger === 'pull') {
      // Cache explanation for later delivery when user requests it
      await db.collection('sessions').updateOne(
        { sessionId: userData.sessionId },
        { $set: { explanation_cache: explanation } }
      );
    } else if (config.explanation_trigger === 'push' || config.explanation_trigger === 'interactive') {
      // Store explanation and deliver immediately to connected client
      await db.collection('explanations').insertOne(explanation);
      const socketId = userData.socketId;
      if (socketId) {
        const io = global.io; // Access global Socket.IO instance

        // Configure rating system if enabled in configuration
        let rating = null;
        if(config.explanation_rating == 'like') {
          rating = 'like';
        }

        // Emit explanation to client via WebSocket
        io.to(socketId).emit('explanation', {
          explanation: data.explanation,
          explanation_id: explanation.explanation_id,
          rating: rating
        });
      }
    }
  };

  // Factory logic: Create appropriate explanation engine based on configuration
  const engineType = config.external_explanation_engine?.external_engine_type;
  const engineApi = config.external_explanation_engine?.external_explanation_engine_api;

  if (engineType === 'ws') {
    // Initialize WebSocket-based explanation engine for real-time communication
    return new WebSocketExplanationEngine(
      engineApi,
      explanationCallback
    );
  } else if (engineType === 'rest') {
    // Initialize REST-based explanation engine for HTTP-based communication
    return new RestExplanationEngine(
      engineApi,
      explanationCallback
    );
  }
  
  // Return null if no valid engine type is configured
  return null;
}