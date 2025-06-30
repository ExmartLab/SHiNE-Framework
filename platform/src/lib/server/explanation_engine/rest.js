
/**
 * @fileoverview REST-based explanation engine for the V-SHINE Study Platform.
 * 
 * This module implements a REST API client for communicating with external explanation services.
 * It provides methods for logging user data, requesting explanations, and handling responses
 * from HTTP-based explanation engines.
 * 
 * The REST engine is used when the external explanation service operates via HTTP endpoints
 * rather than real-time WebSocket connections.
 */

/**
 * REST-based explanation engine that communicates with external services via HTTP API calls.
 * 
 * This class handles two primary functions:
 * 1. Logging user interaction data to the explanation service for analysis
 * 2. Requesting on-demand explanations based on user queries
 * 
 * The engine automatically processes responses and triggers explanation callbacks
 * when explanations are available.
 */
class RestExplanationEngine {

    /** @type {string|null} Base URL of the external explanation service API */
    connectionUrl = null;
    
    /** @type {Function|null} Callback function to process received explanations */
    explanationCallback = null;

    /**
     * Initialize the REST explanation engine with connection details.
     * 
     * @param {string} connectionUrl - Base URL of the external explanation service API
     * @param {Function} explanationCallback - Callback function to handle explanation responses
     */
    constructor(connectionUrl, explanationCallback) {
        this.connectionUrl = connectionUrl;
        this.explanationCallback = explanationCallback;
    }

    /**
     * Get the type identifier for this explanation engine.
     * 
     * @returns {string} Engine type identifier
     */
    getType() {
        return 'Rest';
    }

    /**
     * Log user interaction data to the external explanation service.
     * 
     * This method sends user interaction data to the explanation service's logger endpoint.
     * The service may analyze this data and optionally return an explanation if certain
     * conditions are met (e.g., interesting patterns, rule violations, etc.).
     * 
     * If the service response indicates an explanation should be shown, this method
     * automatically processes the explanation through the callback function.
     * 
     * @param {Object} data - User interaction data to be logged, typically containing:
     *   - user_id: Session identifier
     *   - interaction_type: Type of interaction performed
     *   - device_id: Device that was interacted with
     *   - timestamp: When the interaction occurred
     *   - Additional context-specific fields
     */
    async logData(data) {
        try {
            // Send interaction data to the explanation service's logger endpoint
            let response = await fetch(this.connectionUrl + '/logger', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
    
            let responseData = await response.json();
      
            // Check if the service determined an explanation should be shown
            if(responseData['success'] && responseData['show_explanation']){
                let explanationText = responseData['explanation'];
      
                // Prepare explanation data for callback processing
                let explanationData = {
                    'user_id': responseData['user_id'],
                    'explanation': explanationText,
                }
    
                // Process explanation through the configured callback
                await this.explanationCallback(explanationData);
            }
        } catch (error) {
            console.error('Error calling Explanation REST API: ' + error);
        }

        return;
    }

    /**
     * Request an on-demand explanation from the external service.
     * 
     * This method is used when users explicitly request an explanation, typically
     * through a user interface element like a "Why?" button or help request.
     * The service processes the user's message/context and returns a relevant explanation.
     * 
     * Unlike logData(), this method is synchronous in nature - it makes a request
     * and immediately returns the response rather than using callbacks.
     * 
     * @param {string} userId - Session identifier of the user requesting the explanation
     * @param {string} userMessage - User's message or context for the explanation request
     * @returns {Promise<Object>} Response object containing:
     *   - success: Boolean indicating if the request was successful
     *   - explanation: Generated explanation text (if successful)
     *   - error: Error message (if unsuccessful)
     */
    async requestExplanation(userId, userMessage) {
        try {
            // Send explanation request to the service's explanation endpoint
            const response = await fetch(this.connectionUrl + '/explanation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId, user_message: userMessage })
            });

            const responseData = await response.json();

            // Check if explanation was successfully generated and should be shown
            if (responseData.success && responseData.show_explanation) {
                return {
                    success: true,
                    explanation: responseData.explanation
                };
            }

            // Return failure if no explanation was generated
            return { success: false };
        } catch (error) {
            console.error('Error fetching explanation from REST API:', error);
            return { success: false, error: error.message };
        }
    }

    
}

export default RestExplanationEngine;