/**
 * @fileoverview WebSocket-based explanation engine for the V-SHINE Study Platform.
 * 
 * This module implements a WebSocket client for real-time communication with external
 * explanation services. It provides persistent connection capabilities for logging
 * user data and receiving explanations in real-time.
 * 
 * The WebSocket engine is preferred when the external explanation service requires
 * real-time, bidirectional communication or when low-latency explanation delivery
 * is important for the study experience.
 */

// External dependencies
import io from 'socket.io-client';

/**
 * WebSocket-based explanation engine that maintains real-time connection with external services.
 * 
 * This class provides:
 * 1. Persistent WebSocket connection to explanation services
 * 2. Real-time logging of user interaction data
 * 3. Asynchronous reception of explanations via event listeners
 * 4. Connection state management and monitoring
 * 
 * The engine automatically handles connection events and routes explanation responses
 * through configured callback functions.
 */
class WebSocketExplanationEngine {

    /** @type {Object|null} Socket.IO client instance for WebSocket communication */
    socket = null;
    
    /** @type {boolean} Connection status indicator */
    isConnected = false;

    /**
     * Initialize the WebSocket explanation engine and establish connection.
     * 
     * Sets up event listeners for connection management and explanation reception.
     * The connection is established immediately upon instantiation.
     * 
     * @param {string} connectionUrl - WebSocket URL of the external explanation service
     * @param {Function} explanationCallback - Callback function to handle received explanations
     */
    constructor(connectionUrl, explanationCallback) {
        // Initialize Socket.IO client connection
        this.socket = io(connectionUrl);

        // Set up connection event listeners
        this.socket.on('connect', () => {
            this.isConnected = true; 
        });

        // Set up explanation reception handler
        this.socket.on('explanation_receival', async (explanationData) => {
            await explanationCallback(explanationData);
        });
    }

    /**
     * Get the type identifier for this explanation engine.
     * 
     * @returns {string} Engine type identifier
     */
    getType() {
        return 'Websocket';
    }

    /**
     * Log user interaction data to the external explanation service via WebSocket.
     * 
     * This method sends user interaction data in real-time to the explanation service.
     * The service can process this data and potentially send back explanations
     * asynchronously through the 'explanation_receival' event listener.
     * 
     * Data is only sent if the WebSocket connection is currently active.
     * 
     * @param {Object} data - User interaction data to be logged, typically containing:
     *   - user_id: Session identifier
     *   - interaction_type: Type of interaction performed
     *   - device_id: Device that was interacted with
     *   - timestamp: When the interaction occurred
     *   - Additional context-specific fields
     */
    logData(data) {
        if (this.isConnected) {
            this.socket.emit('user_log', data);
        }
    }

    /**
     * Request an on-demand explanation from the external service via WebSocket.
     * 
     * This method sends an explanation request to the service and immediately returns
     * a success status. The actual explanation will be received asynchronously through
     * the 'explanation_receival' event listener and processed by the callback function.
     * 
     * This differs from the REST implementation which waits for a synchronous response.
     * The WebSocket approach allows for more complex processing on the service side
     * while maintaining real-time user experience.
     * 
     * @param {string} userId - Session identifier of the user requesting the explanation
     * @param {string} userMessage - User's message or context for the explanation request
     * @returns {Object|undefined} Response object with success status if connected, undefined if not connected
     */
    requestExplanation(userId, userMessage) {
        if(this.isConnected) {
            // Send explanation request via WebSocket
            this.socket.emit('explanation_request', {
                user_id: userId,
                user_message: userMessage
            });
            // Return immediate success - actual explanation will come via callback
            return {success: true, explanation: null};
        }
        // Return undefined if not connected (could be improved to return explicit failure)
    }
}

export default WebSocketExplanationEngine;