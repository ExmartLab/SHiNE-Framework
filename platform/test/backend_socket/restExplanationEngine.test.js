import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

global.fetch = vi.fn()

const { default: RestExplanationEngine } = await vi.importActual('../../src/lib/server/explanation_engine/rest.js')

describe('RestExplanationEngine', () => {
  let restEngine
  let mockCallback
  let consoleSpy

  beforeEach(() => {
    mockCallback = vi.fn()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    restEngine = new RestExplanationEngine(
      'http://localhost:5000',
      mockCallback
    )

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleSpy.mockRestore()
  })

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(restEngine.connectionUrl).toBe('http://localhost:5000')
      expect(restEngine.explanationCallback).toBe(mockCallback)
    })

    it('should handle null values', () => {
      const nullEngine = new RestExplanationEngine(null, null)
      
      expect(nullEngine.connectionUrl).toBe(null)
      expect(nullEngine.explanationCallback).toBe(null)
    })
  })

  describe('getType', () => {
    it('should return Rest as type', () => {
      expect(restEngine.getType()).toBe('Rest')
    })
  })

  describe('logData', () => {
    describe('Successful API Response', () => {
      it('should call callback when show_explanation is true', async () => {
        const mockResponse = {
          success: true,
          show_explanation: true,
          explanation: 'Test explanation text',
          user_id: 'test-user-123'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click',
          device_id: 'light-1',
          timestamp: new Date().toISOString()
        }

        await restEngine.logData(inputData)

        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/logger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(inputData)
        })

        expect(mockCallback).toHaveBeenCalledWith({
          user_id: 'test-user-123',
          explanation: 'Test explanation text'
        })
      })

      it('should not call callback when show_explanation is false', async () => {
        const mockResponse = {
          success: true,
          show_explanation: false,
          explanation: 'Hidden explanation',
          user_id: 'test-user-123'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        await restEngine.logData(inputData)

        expect(fetch).toHaveBeenCalled()
        expect(mockCallback).not.toHaveBeenCalled()
      })

      it('should not call callback when success is false', async () => {
        const mockResponse = {
          success: false,
          show_explanation: true,
          explanation: 'Error explanation',
          user_id: 'test-user-123'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        await restEngine.logData(inputData)

        expect(fetch).toHaveBeenCalled()
        expect(mockCallback).not.toHaveBeenCalled()
      })

      it('should handle missing explanation field', async () => {
        const mockResponse = {
          success: true,
          show_explanation: true,
          user_id: 'test-user-123'
          // Missing explanation field
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        await restEngine.logData(inputData)

        expect(mockCallback).toHaveBeenCalledWith({
          user_id: 'test-user-123',
          explanation: undefined
        })
      })
    })

    describe('Error Handling', () => {
      it('should handle fetch network errors', async () => {
        const networkError = new Error('Network failure')
        fetch.mockRejectedValue(networkError)

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        await restEngine.logData(inputData)

        expect(consoleSpy).toHaveBeenCalledWith('Error calling Explanation REST API: Error: Network failure')
        expect(mockCallback).not.toHaveBeenCalled()
      })

      it('should handle JSON parsing errors', async () => {
        const jsonError = new Error('Invalid JSON')
        fetch.mockResolvedValue({
          json: vi.fn().mockRejectedValue(jsonError)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        await restEngine.logData(inputData)

        expect(consoleSpy).toHaveBeenCalledWith('Error calling Explanation REST API: Error: Invalid JSON')
        expect(mockCallback).not.toHaveBeenCalled()
      })

      it('should handle callback execution errors', async () => {
        const callbackError = new Error('Callback failed')
        mockCallback.mockRejectedValue(callbackError)

        const mockResponse = {
          success: true,
          show_explanation: true,
          explanation: 'Test explanation',
          user_id: 'test-user-123'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        // logData catches all errors and logs them, doesn't re-throw
        await restEngine.logData(inputData)

        expect(mockCallback).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('Error calling Explanation REST API: Error: Callback failed')
      })

      it('should handle malformed response data', async () => {
        const mockResponse = null

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = {
          user_id: 'test-user-123',
          interaction_type: 'device_click'
        }

        await restEngine.logData(inputData)

        expect(mockCallback).not.toHaveBeenCalled()
      })
    })

    describe('Request Format', () => {
      it('should send correct headers and method', async () => {
        const mockResponse = {
          success: false,
          show_explanation: false
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const inputData = { test: 'data' }

        await restEngine.logData(inputData)

        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/logger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(inputData)
        })
      })

      it('should handle empty input data', async () => {
        const mockResponse = {
          success: true,
          show_explanation: false
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        await restEngine.logData({})

        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/logger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })
      })
    })
  })

  describe('requestExplanation', () => {
    describe('Successful Requests', () => {
      it('should return explanation when successful', async () => {
        const mockResponse = {
          success: true,
          show_explanation: true,
          explanation: 'Requested explanation text'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const result = await restEngine.requestExplanation('user-123', 'Why did the light turn on?')

        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/explanation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: 'user-123',
            user_message: 'Why did the light turn on?'
          })
        })

        expect(result).toEqual({
          success: true,
          explanation: 'Requested explanation text'
        })
      })

      it('should return failure when success is false', async () => {
        const mockResponse = {
          success: false,
          show_explanation: true,
          explanation: 'Error explanation'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        expect(result).toEqual({ success: false })
      })

      it('should return failure when show_explanation is false', async () => {
        const mockResponse = {
          success: true,
          show_explanation: false,
          explanation: 'Hidden explanation'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        expect(result).toEqual({ success: false })
      })

      it('should handle missing explanation in response', async () => {
        const mockResponse = {
          success: true,
          show_explanation: true
          // Missing explanation field
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        expect(result).toEqual({
          success: true,
          explanation: undefined
        })
      })
    })

    describe('Error Handling', () => {
      it('should handle network errors', async () => {
        const networkError = new Error('Connection refused')
        fetch.mockRejectedValue(networkError)

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching explanation from REST API:', networkError)
        expect(result).toEqual({
          success: false,
          error: 'Connection refused'
        })
      })

      it('should handle JSON parsing errors', async () => {
        const jsonError = new Error('Unexpected token')
        fetch.mockResolvedValue({
          json: vi.fn().mockRejectedValue(jsonError)
        })

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching explanation from REST API:', jsonError)
        expect(result).toEqual({
          success: false,
          error: 'Unexpected token'
        })
      })

      it('should handle empty response', async () => {
        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(null)
        })

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        // When responseData is null, accessing responseData.success throws an error
        expect(result).toEqual({ 
          success: false, 
          error: "Cannot read properties of null (reading 'success')" 
        })
      })

      it('should handle malformed response', async () => {
        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue('not an object')
        })

        const result = await restEngine.requestExplanation('user-123', 'Why?')

        expect(result).toEqual({ success: false })
      })
    })

    describe('Request Parameters', () => {
      it('should handle empty user message', async () => {
        const mockResponse = {
          success: true,
          show_explanation: true,
          explanation: 'Default explanation'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const result = await restEngine.requestExplanation('user-123', '')

        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/explanation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: 'user-123',
            user_message: ''
          })
        })

        expect(result.success).toBe(true)
      })

      it('should handle null parameters', async () => {
        const mockResponse = {
          success: true,
          show_explanation: true,
          explanation: 'Null handling explanation'
        }

        fetch.mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockResponse)
        })

        const result = await restEngine.requestExplanation(null, null)

        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/explanation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: null,
            user_message: null
          })
        })

        expect(result.success).toBe(true)
      })
    })
  })

  describe('Integration Tests', () => {
    it('should complete full logData workflow with explanation', async () => {
      const mockResponse = {
        success: true,
        show_explanation: true,
        explanation: 'Integration test explanation',
        user_id: 'integration-user'
      }

      fetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse)
      })

      const inputData = {
        user_id: 'integration-user',
        interaction_type: 'device_interaction',
        device_id: 'thermostat-1',
        property: 'temperature',
        value: 22,
        timestamp: new Date().toISOString()
      }

      await restEngine.logData(inputData)

      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/logger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inputData)
      })

      expect(mockCallback).toHaveBeenCalledWith({
        user_id: 'integration-user',
        explanation: 'Integration test explanation'
      })
    })

    it('should complete full requestExplanation workflow', async () => {
      const mockResponse = {
        success: true,
        show_explanation: true,
        explanation: 'The thermostat was set to maintain comfort levels'
      }

      fetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse)
      })

      const result = await restEngine.requestExplanation(
        'integration-user',
        'Why did the thermostat change temperature?'
      )

      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: 'integration-user',
          user_message: 'Why did the thermostat change temperature?'
        })
      })

      expect(result).toEqual({
        success: true,
        explanation: 'The thermostat was set to maintain comfort levels'
      })
    })

    it('should handle both methods with same engine instance', async () => {
      // First call logData
      fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          success: true,
          show_explanation: false
        })
      })

      await restEngine.logData({ user_id: 'test-user' })

      // Then call requestExplanation
      fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          success: true,
          show_explanation: true,
          explanation: 'On-demand explanation'
        })
      })

      const result = await restEngine.requestExplanation('test-user', 'Why?')

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
      expect(result.explanation).toBe('On-demand explanation')
    })
  })
})