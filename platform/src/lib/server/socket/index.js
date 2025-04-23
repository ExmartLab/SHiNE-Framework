// src/lib/server/socket/index.js
import { handleDeviceInteraction } from "./deviceInteractionHandler.js";
import { handleGameInteraction } from "./gameInteractionHandler.js";
import { handleTaskTimeout } from "./taskTimeoutHandler.js";
import { handleTaskAbort } from "./taskAbortHandler.js";
import { handleExplanationRequest } from "./explanationRequestHandler.js";
import { handleGameStart } from "./gameStartHandler.js";

/**
 * Set up all socket event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} db - MongoDB database connection
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationConfig - Explanation configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export function setupSocketHandlers(io, db, gameConfig, explanationConfig, explanationEngine) {
    // Make io available globally for the explanation engine
    global.io = io;

    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);

        // Register all event handlers
        socket.on('device-interaction', data =>
            handleDeviceInteraction(socket, db, data, gameConfig, explanationConfig, explanationEngine));

        socket.on('game-interaction', data =>
            handleGameInteraction(socket, db, data, gameConfig, explanationEngine));

        socket.on('task-timeout', data =>
            handleTaskTimeout(socket, db, data, gameConfig, explanationEngine));

        socket.on('task-abort', data =>
            handleTaskAbort(socket, db, data, gameConfig, explanationEngine));

        socket.on('explanation_request', data =>
            handleExplanationRequest(socket, db, data, explanationConfig, explanationEngine));

        socket.on('game-start', data =>
            handleGameStart(socket, db, data, gameConfig, explanationEngine));

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
}