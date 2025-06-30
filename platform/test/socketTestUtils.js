import { Server } from 'socket.io'
import { io as Client } from 'socket.io-client'
import { createServer } from 'http'

export class SocketTestHarness {
  constructor() {
    this.httpServer = null
    this.io = null
    this.serverSocket = null
    this.clientSocket = null
    this.port = null
  }

  async setup() {
    return new Promise((resolve) => {
      this.httpServer = createServer()
      this.io = new Server(this.httpServer)
      
      this.httpServer.listen(() => {
        this.port = this.httpServer.address().port
        this.clientSocket = Client(`http://localhost:${this.port}`)
        
        this.io.on('connection', (socket) => {
          this.serverSocket = socket
        })
        
        this.clientSocket.on('connect', resolve)
      })
    })
  }

  async cleanup() {
    if (this.io) {
      this.io.close()
    }
    if (this.clientSocket) {
      this.clientSocket.close()
    }
    if (this.httpServer) {
      this.httpServer.close()
    }
  }

  // Helper to wait for socket events
  waitForEvent(socket, event) {
    return new Promise((resolve) => {
      socket.once(event, resolve)
    })
  }

  // Helper to emit and wait for response
  async emitAndWait(event, data, responseEvent) {
    const responsePromise = this.waitForEvent(this.clientSocket, responseEvent)
    this.clientSocket.emit(event, data)
    return responsePromise
  }
}