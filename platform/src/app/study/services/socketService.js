// services/socketService.js
import io from 'socket.io-client';

let socket;

export const initializeSocket = () => {
  if (!socket) {
    socket = io();
  }
  
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
};