/**
 * @fileoverview Factory module for configuring explanation engines in the V-SHINE Study Platform.
 * 
 * This module provides a factory function that sets up explanation engines based on configuration.
 * It supports both WebSocket and REST-based external explanation engines, with configurable
 * triggers (on-demand vs automatic) and rating systems.
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
 * Creates explanation engines that can operate in two modes:
 * - On-demand: Explanations are cached and delivered when requested by the user
 * - Automatic: Explanations are delivered immediately when triggered by system events
 * 
 * @param {Object} db - MongoDB database connection for storing explanations and session data
 * @param {Object} config - Explanation engine configuration object containing:
 *   - explanation_engine: String indicating if external engine should be used
 *   - external_engine_type: Type of engine ('ws' for WebSocket, 'rest' for REST API)
 *   - external_explanation_engine_api: URL of the external explanation service
 *   - explanation_trigger: Trigger mode ('on_demand' or 'automatic')
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
   * 4. Routes explanation based on trigger configuration (on-demand vs automatic)
   * 5. Delivers explanation to client via WebSocket if automatic
   * 
   * @param {Object} data - Explanation data from external engine containing:
   *   - user_id: Session ID of the user requesting explanation
   *   - explanation: Generated explanation text
   *   - enforce_automatic_explanation: Optional flag to override trigger mode
   */
  const explanationCallback = async (data) => {
    // Validate user session and retrieve session data from database
    const userData = await db.collection('sessions').findOne({ sessionId: data.user_id });
    if (!userData) return;

    // Find the currently active task for this user to provide context
    const currentTask = await db.collection('tasks').findOne({ 
      userSessionId: data.user_id, 
      startTime: { $lte: new Date() }, 
      endTime: { $gte: new Date() } 
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

    // Check if automatic explanation delivery should be enforced regardless of configuration
    let enforcedAutomaticExplanation = false;
    if (data.enforce_automatic_explanation != null && data.enforce_automatic_explanation === true) {
      enforcedAutomaticExplanation = true;
    }
      
    // Handle explanation routing based on trigger configuration
    if (config.explanation_trigger === 'on_demand' && !enforcedAutomaticExplanation) {
      // Cache explanation for later delivery when user requests it
      await db.collection('sessions').updateOne(
        { sessionId: userData.sessionId }, 
        { $set: { explanation_cache: explanation } }
      );
    } else if (config.explanation_trigger === 'automatic' || enforcedAutomaticExplanation) {
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
  if (config.external_engine_type === 'ws') {
    // Initialize WebSocket-based explanation engine for real-time communication
    return new WebSocketExplanationEngine(
      config.external_explanation_engine_api, 
      explanationCallback
    );
  } else if (config.external_engine_type === 'rest') {
    // Initialize REST-based explanation engine for HTTP-based communication
    return new RestExplanationEngine(
      config.external_explanation_engine_api, 
      explanationCallback
    );
  }
  
  // Return null if no valid engine type is configured
  return null;
}