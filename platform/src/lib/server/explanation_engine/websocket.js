// Import socket
import io from 'socket.io-client';

class WebSocketExplanationEngine {

    socket = null;
    isConnected = false;

    constructor(connectionUrl, explanationCallback) {
        this.socket = io(connectionUrl);


        this.socket.on('connect', () => {
            this.isConnected = true; 
            console.log('Connected to the WebSocket server');
        });

        this.socket.on('explanation_receival', async (explanationData) => {
            console.log('Received explanation:', explanationData);
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

    sendUserData(userData) {
        if (this.isConnected) {
            this.socket.emit('user_metadata', userData);
        }
    }

    sendUserLog(userLog) {
        if (this.isConnected) {
            this.socket.emit('user_log', userLog);
        }
    }
}

export default WebSocketExplanationEngine;