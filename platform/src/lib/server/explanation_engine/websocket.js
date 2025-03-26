// Import socket
import io from 'socket.io-client';

class WebSocketExplanationEngine {

    socket = null;
    isConnected = false;

    constructor(connectionUrl) {
        this.socket = io.connect(connectionUrl);
        this.socket.on('connect', () => {
            this.isConnected = true; 
        });
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