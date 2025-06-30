/**
 * WebSocket service for real-time communication in the smart home study platform
 * Manages Socket.IO client connection lifecycle and provides a singleton pattern
 * for consistent socket usage across the application
 */

import io from 'socket.io-client';

/** Singleton socket instance shared across the application */
let socket;

/**
 * Initializes a new Socket.IO connection if one doesn't exist
 * Uses singleton pattern to ensure only one connection per session
 * 
 * @returns {Socket} The Socket.IO client instance
 */
export const initializeSocket = () => {
  if (!socket) {
    // Create new socket connection to the same origin as the web page
    socket = io();
  }
  
  return socket;
};

/**
 * Retrieves the existing socket instance or creates a new one if needed
 * Provides lazy initialization for socket connections
 * 
 * @returns {Socket} The Socket.IO client instance
 */
export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

/**
 * Cleanly closes the socket connection and clears the instance
 * Should be called when the user leaves the study or on app cleanup
 * Sets socket to undefined to allow for re-initialization if needed
 */
export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
};