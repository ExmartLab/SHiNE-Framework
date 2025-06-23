// Import socket
import io from 'socket.io-client';

class WebSocketExplanationEngine {

    socket = null;
    isConnected = false;

    constructor(connectionUrl, explanationCallback) {
        this.socket = io(connectionUrl);


        this.socket.on('connect', () => {
            this.isConnected = true; 
        });

        this.socket.on('explanation_receival', async (explanationData) => {
            await explanationCallback(explanationData);
        });
    }

    getType() {
        return 'Websocket';
    }

    logData(data) {
        if (this.isConnected) {
            this.socket.emit('user_log', data);
        }
    }

    requestExplanation(userId, userMessage) {
        if(this.isConnected) {
            this.socket.emit('explanation_request', {
                user_id: userId,
                user_message: userMessage
            });
            return {success: true, explanation: null};
        }
    }
}

export default WebSocketExplanationEngine;