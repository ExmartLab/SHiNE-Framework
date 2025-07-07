import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true
}

const mockIo = vi.fn(() => mockSocket)

vi.mock('socket.io-client', () => ({
  default: mockIo
}))

const { default: WebSocketExplanationEngine } = await vi.importActual('../src/lib/server/explanation_engine/websocket.js')

describe('WebSocketExplanationEngine', () => {
  let wsEngine
  let mockCallback
  let connectCallback
  let explanationCallback

  beforeEach(() => {
    mockCallback = vi.fn()
    
    // Reset mocks before creating engine
    vi.clearAllMocks()
    
    wsEngine = new WebSocketExplanationEngine(
      'ws://localhost:5000',
      mockCallback
    )

    // Capture the callbacks passed to socket.on()
    const onCalls = mockSocket.on.mock.calls
    connectCallback = onCalls.find(call => call[0] === 'connect')?.[1]
    explanationCallback = onCalls.find(call => call[0] === 'explanation_receival')?.[1]
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize Socket.IO connection with correct URL', () => {
      expect(mockIo).toHaveBeenCalledWith('ws://localhost:5000')
      expect(wsEngine.socket).toBe(mockSocket)
      expect(wsEngine.isConnected).toBe(false)
    })

    it('should set up connection event listener', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    })

    it('should set up explanation receival event listener', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('explanation_receival', expect.any(Function))
    })

    it('should handle null connection URL', () => {
      vi.clearAllMocks()
      const nullEngine = new WebSocketExplanationEngine(null, mockCallback)
      
      expect(mockIo).toHaveBeenCalledWith(null)
      expect(nullEngine.socket).toBe(mockSocket)
    })

    it('should handle null callback', () => {
      vi.clearAllMocks()
      const nullCallbackEngine = new WebSocketExplanationEngine('ws://localhost:5000', null)
      
      expect(mockIo).toHaveBeenCalledWith('ws://localhost:5000')
      expect(nullCallbackEngine.socket).toBe(mockSocket)
    })
  })

  describe('getType', () => {
    it('should return Websocket as type', () => {
      expect(wsEngine.getType()).toBe('Websocket')
    })
  })

  describe('Connection Management', () => {
    it('should set isConnected to true on connect event', () => {
      expect(wsEngine.isConnected).toBe(false)
      
      // Simulate connection event
      if (connectCallback) {
        connectCallback()
      }
      
      expect(wsEngine.isConnected).toBe(true)
    })

    it('should start with disconnected state', () => {
      expect(wsEngine.isConnected).toBe(false)
    })
  })

  describe('logData', () => {
    describe('When Connected', () => {
      beforeEach(() => {
        wsEngine.isConnected = true
      })

      it('should emit user_log event with data', () => {
        const testData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click',
          device_id: 'light-1',
          timestamp: new Date().toISOString()
        }

        wsEngine.logData(testData)

        expect(mockSocket.emit).toHaveBeenCalledWith('user_log', testData)
      })

      it('should handle empty data object', () => {
        wsEngine.logData({})

        expect(mockSocket.emit).toHaveBeenCalledWith('user_log', {})
      })

      it('should handle null data', () => {
        wsEngine.logData(null)

        expect(mockSocket.emit).toHaveBeenCalledWith('user_log', null)
      })

      it('should handle complex data structures', () => {
        const complexData = {
          user_id: 'test-user',
          nested: {
            property: 'value',
            array: [1, 2, 3]
          },
          metadata: {
            timestamp: new Date(),
            deviceProperties: ['brightness', 'color']
          }
        }

        wsEngine.logData(complexData)

        expect(mockSocket.emit).toHaveBeenCalledWith('user_log', complexData)
      })
    })

    describe('When Disconnected', () => {
      beforeEach(() => {
        wsEngine.isConnected = false
      })

      it('should not emit when disconnected', () => {
        const testData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        wsEngine.logData(testData)

        expect(mockSocket.emit).not.toHaveBeenCalled()
      })
    })
  })

  describe('requestExplanation', () => {
    describe('When Connected', () => {
      beforeEach(() => {
        wsEngine.isConnected = true
      })

      it('should emit explanation_request and return success', () => {
        const result = wsEngine.requestExplanation('user-123', 'Why did the light turn on?')

        expect(mockSocket.emit).toHaveBeenCalledWith('explanation_request', {
          user_id: 'user-123',
          user_message: 'Why did the light turn on?'
        })

        expect(result).toEqual({
          success: true,
          explanation: null
        })
      })

      it('should handle empty user message', () => {
        const result = wsEngine.requestExplanation('user-123', '')

        expect(mockSocket.emit).toHaveBeenCalledWith('explanation_request', {
          user_id: 'user-123',
          user_message: ''
        })

        expect(result).toEqual({
          success: true,
          explanation: null
        })
      })

      it('should handle long user messages', () => {
        const longMessage = 'A'.repeat(1000)
        const result = wsEngine.requestExplanation('user-123', longMessage)

        expect(mockSocket.emit).toHaveBeenCalledWith('explanation_request', {
          user_id: 'user-123',
          user_message: longMessage
        })

        expect(result).toEqual({
          success: true,
          explanation: null
        })
      })
    })

    describe('When Disconnected', () => {
      beforeEach(() => {
        wsEngine.isConnected = false
      })

      it('should not emit and return undefined when disconnected', () => {
        const result = wsEngine.requestExplanation('user-123', 'Why?')

        expect(mockSocket.emit).not.toHaveBeenCalled()
        expect(result).toBeUndefined()
      })

      it('should return undefined even with valid parameters when disconnected', () => {
        const result = wsEngine.requestExplanation('valid-user', 'Valid question?')

        expect(mockSocket.emit).not.toHaveBeenCalled()
        expect(result).toBeUndefined()
      })
    })
  })

  describe('Explanation Receival', () => {
    it('should call callback when explanation_receival event is received', async () => {
      const explanationData = {
        user_id: 'test-user-123',
        explanation: 'The light turned on because of the motion sensor.'
      }

      if (explanationCallback) {
        await explanationCallback(explanationData)
      }

      expect(mockCallback).toHaveBeenCalledWith(explanationData)
    })

    it('should handle empty explanation data', async () => {
      const emptyData = {}

      if (explanationCallback) {
        await explanationCallback(emptyData)
      }

      expect(mockCallback).toHaveBeenCalledWith(emptyData)
    })

    it('should handle null explanation data', async () => {
      if (explanationCallback) {
        await explanationCallback(null)
      }

      expect(mockCallback).toHaveBeenCalledWith(null)
    })

    it('should handle callback errors gracefully', async () => {
      const callbackError = new Error('Callback processing failed')
      mockCallback.mockRejectedValue(callbackError)

      const explanationData = {
        user_id: 'test-user',
        explanation: 'Test explanation'
      }

      if (explanationCallback) {
        await expect(explanationCallback(explanationData)).rejects.toThrow('Callback processing failed')
      }

      expect(mockCallback).toHaveBeenCalledWith(explanationData)
    })
  })

  describe('Integration Tests', () => {
    it('should complete full workflow from connection to explanation receival', async () => {
      // Simulate connection
      if (connectCallback) {
        connectCallback()
      }
      expect(wsEngine.isConnected).toBe(true)

      // Log some data
      const logData = {
        user_id: 'integration-user',
        interaction_type: 'device_interaction',
        device_id: 'smart-thermostat'
      }
      wsEngine.logData(logData)
      expect(mockSocket.emit).toHaveBeenCalledWith('user_log', logData)

      // Request explanation
      const result = wsEngine.requestExplanation('integration-user', 'Why did temperature change?')
      expect(mockSocket.emit).toHaveBeenCalledWith('explanation_request', {
        user_id: 'integration-user',
        user_message: 'Why did temperature change?'
      })
      expect(result).toEqual({ success: true, explanation: null })

      // Receive explanation
      const explanationData = {
        user_id: 'integration-user',
        explanation: 'Temperature changed due to scheduled automation'
      }
      if (explanationCallback) {
        await explanationCallback(explanationData)
      }
      expect(mockCallback).toHaveBeenCalledWith(explanationData)
    })

    it('should handle disconnected state throughout workflow', () => {
      // Start disconnected
      expect(wsEngine.isConnected).toBe(false)

      // Try to log data - should not emit
      wsEngine.logData({ user_id: 'test-user' })
      expect(mockSocket.emit).not.toHaveBeenCalled()

      // Try to request explanation - should return undefined
      const result = wsEngine.requestExplanation('test-user', 'Why?')
      expect(result).toBeUndefined()
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('should handle connection state changes', () => {
      // Start disconnected
      expect(wsEngine.isConnected).toBe(false)

      // Connect
      if (connectCallback) {
        connectCallback()
      }
      expect(wsEngine.isConnected).toBe(true)

      // Now operations should work
      wsEngine.logData({ test: 'data' })
      expect(mockSocket.emit).toHaveBeenCalledWith('user_log', { test: 'data' })

      const result = wsEngine.requestExplanation('user', 'message')
      expect(result).toEqual({ success: true, explanation: null })
    })
  })

  describe('Error Scenarios', () => {
    it('should handle Socket.IO initialization errors', () => {
      const errorMock = vi.fn(() => {
        throw new Error('Socket.IO connection failed')
      })
      
      // Mock the io function to throw an error
      vi.mocked(mockIo).mockImplementationOnce(errorMock)

      expect(() => {
        new WebSocketExplanationEngine('ws://invalid:5000', mockCallback)
      }).toThrow('Socket.IO connection failed')
      
      // Restore the mock
      vi.mocked(mockIo).mockImplementation(() => mockSocket)
    })

    it('should handle missing event callbacks gracefully', () => {
      // Test when callbacks are not properly captured
      const wsEngineWithoutCallbacks = new WebSocketExplanationEngine('ws://localhost:5000', mockCallback)
      
      // Operations should still work even if we can't test the callbacks
      wsEngineWithoutCallbacks.isConnected = true
      wsEngineWithoutCallbacks.logData({ test: 'data' })
      
      expect(mockSocket.emit).toHaveBeenCalledWith('user_log', { test: 'data' })
    })
  })

  describe('Socket Events', () => {
    it('should register exactly two event listeners', () => {
      expect(mockSocket.on).toHaveBeenCalledTimes(2)
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('explanation_receival', expect.any(Function))
    })

    it('should use async callback for explanation receival', () => {
      const explanationCall = mockSocket.on.mock.calls.find(call => call[0] === 'explanation_receival')
      const callback = explanationCall?.[1]
      
      // Check that the callback exists and is async
      expect(callback).toBeDefined()
      expect(callback.constructor.name).toBe('AsyncFunction')
    })
  })
})