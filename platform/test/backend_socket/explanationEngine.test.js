import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/lib/server/explanation_engine/websocket.js', () => ({
  default: vi.fn().mockImplementation((url, callback) => ({
    connectionUrl: url,
    explanationCallback: callback,
    type: 'WebSocket',
    getType: vi.fn(() => 'WebSocket'),
    logData: vi.fn()
  }))
}))

vi.mock('../../src/lib/server/explanation_engine/rest.js', () => ({
  default: vi.fn().mockImplementation((url, callback) => ({
    connectionUrl: url,
    explanationCallback: callback,
    type: 'REST',
    getType: vi.fn(() => 'REST'),
    logData: vi.fn()
  }))
}))

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}))

const { setupExplanationEngine } = await vi.importActual('../../src/lib/server/explanation_engine/index.js')

describe('Explanation Engine', () => {
  let mockDb
  let mockSessionsCollection
  let mockTasksCollection
  let mockExplanationsCollection
  let mockIo
  let mockSocket

  beforeEach(() => {
    mockSessionsCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(() => Promise.resolve())
    }

    mockTasksCollection = {
      findOne: vi.fn()
    }

    mockExplanationsCollection = {
      insertOne: vi.fn(() => Promise.resolve())
    }

    mockDb = {
      collection: vi.fn((collectionName) => {
        if (collectionName === 'sessions') return mockSessionsCollection
        if (collectionName === 'tasks') return mockTasksCollection
        if (collectionName === 'explanations') return mockExplanationsCollection
        return { findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn() }
      })
    }

    mockSocket = {
      emit: vi.fn()
    }

    mockIo = {
      to: vi.fn(() => mockSocket)
    }

    global.io = mockIo

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete global.io
  })

  describe('setupExplanationEngine', () => {
    it('should return null if explanation_engine is not external', async () => {
      const config = {
        explanation_engine: 'internal'
      }

      const result = await setupExplanationEngine(mockDb, config)

      expect(result).toBeNull()
    })

    it('should create WebSocket engine when type is ws', async () => {
      const config = {
        explanation_engine: 'external',
        external_explanation_engine: {
          external_engine_type: 'ws',
          external_explanation_engine_api: 'ws://localhost:5000'
        },
        explanation_trigger: 'automatic',
        explanation_rating: 'like'
      }

      const WebSocketExplanationEngine = (await import('../../src/lib/server/explanation_engine/websocket.js')).default

      const result = await setupExplanationEngine(mockDb, config)

      expect(WebSocketExplanationEngine).toHaveBeenCalledWith(
        'ws://localhost:5000',
        expect.any(Function)
      )
      expect(result).toBeDefined()
      expect(result.type).toBe('WebSocket')
    })

    it('should create REST engine when type is rest', async () => {
      const config = {
        explanation_engine: 'external',
        external_explanation_engine: {
          external_engine_type: 'rest',
          external_explanation_engine_api: 'http://localhost:5000'
        },
        explanation_trigger: 'on_demand',
        explanation_rating: null
      }

      const RestExplanationEngine = (await import('../../src/lib/server/explanation_engine/rest.js')).default

      const result = await setupExplanationEngine(mockDb, config)

      expect(RestExplanationEngine).toHaveBeenCalledWith(
        'http://localhost:5000',
        expect.any(Function)
      )
      expect(result).toBeDefined()
      expect(result.type).toBe('REST')
    })

    it('should return null for unsupported engine type', async () => {
      const config = {
        explanation_engine: 'external',
        external_engine_type: 'unknown',
        external_explanation_engine_api: 'http://localhost:5000'
      }

      const result = await setupExplanationEngine(mockDb, config)

      expect(result).toBeNull()
    })
  })

  describe('Explanation Callback', () => {
    let explanationCallback
    let config

    beforeEach(async () => {
      config = {
        explanation_engine: 'external',
        external_explanation_engine: {
          external_engine_type: 'ws',
          external_explanation_engine_api: 'ws://localhost:5000'
        },
        explanation_trigger: 'automatic',
        explanation_rating: 'like'
      }

      const engine = await setupExplanationEngine(mockDb, config)
      explanationCallback = engine.explanationCallback
    })

    describe('Automatic Mode', () => {
      beforeEach(() => {
        config.explanation_trigger = 'automatic'
      })

      it('should store explanation and emit to socket for automatic mode', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        const currentTask = {
          taskId: 'task-789'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(currentTask)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'This is a test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockExplanationsCollection.insertOne).toHaveBeenCalledWith({
          explanation_id: 'test-uuid-123',
          explanation: 'This is a test explanation',
          created_at: expect.any(Date),
          userSessionId: 'test-session-123',
          taskId: 'task-789',
          delay: 0
        })

        expect(mockIo.to).toHaveBeenCalledWith('socket-456')
        expect(mockSocket.emit).toHaveBeenCalledWith('explanation', {
          explanation: 'This is a test explanation',
          explanation_id: 'test-uuid-123',
          rating: 'like'
        })
      })

      it('should handle missing current task', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockExplanationsCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: ''
          })
        )
      })

      it('should not emit if no socket ID', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: null
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockExplanationsCollection.insertOne).toHaveBeenCalled()
        expect(mockIo.to).not.toHaveBeenCalled()
        expect(mockSocket.emit).not.toHaveBeenCalled()
      })

      it('should set rating to null when not configured', async () => {
        config.explanation_rating = null

        const engine = await setupExplanationEngine(mockDb, config)
        explanationCallback = engine.explanationCallback

        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockSocket.emit).toHaveBeenCalledWith('explanation', {
          explanation: 'Test explanation',
          explanation_id: 'test-uuid-123',
          rating: null
        })
      })
    })

    describe('On-Demand Mode', () => {
      beforeEach(async () => {
        config.explanation_trigger = 'on_demand'
        const engine = await setupExplanationEngine(mockDb, config)
        explanationCallback = engine.explanationCallback
      })

      it('should cache explanation for on-demand mode', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        const currentTask = {
          taskId: 'task-789'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(currentTask)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Cached explanation'
        }

        await explanationCallback(explanationData)

        expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
          { sessionId: 'test-session-123' },
          {
            $set: {
              explanation_cache: {
                explanation_id: 'test-uuid-123',
                explanation: 'Cached explanation',
                created_at: expect.any(Date),
                userSessionId: 'test-session-123',
                taskId: 'task-789',
                delay: 0
              }
            }
          }
        )

        expect(mockExplanationsCollection.insertOne).not.toHaveBeenCalled()
        expect(mockSocket.emit).not.toHaveBeenCalled()
      })

      it('should override on-demand with enforce_automatic_explanation flag', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Enforced automatic explanation',
          enforce_automatic_explanation: true
        }

        await explanationCallback(explanationData)

        expect(mockExplanationsCollection.insertOne).toHaveBeenCalled()
        expect(mockSocket.emit).toHaveBeenCalled()
        expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
      })

      it('should not override when enforce_automatic_explanation is false', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'On-demand explanation',
          enforce_automatic_explanation: false
        }

        await explanationCallback(explanationData)

        expect(mockSessionsCollection.updateOne).toHaveBeenCalled()
        expect(mockExplanationsCollection.insertOne).not.toHaveBeenCalled()
        expect(mockSocket.emit).not.toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      it('should return early if user session not found', async () => {
        mockSessionsCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'invalid-session',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockTasksCollection.findOne).not.toHaveBeenCalled()
        expect(mockExplanationsCollection.insertOne).not.toHaveBeenCalled()
        expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
      })

      it('should handle database errors gracefully', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockRejectedValue(new Error('Database error'))

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await expect(explanationCallback(explanationData)).rejects.toThrow('Database error')
      })

      it('should handle missing explanation data', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123'
          // Missing explanation field
        }

        await explanationCallback(explanationData)

        expect(mockExplanationsCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            explanation: undefined
          })
        )
      })
    })

    describe('Task Context', () => {
      it('should find current task based on time range', async () => {
        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        const fixedDate = new Date('2023-01-01T12:00:00Z')
        vi.spyOn(global, 'Date').mockImplementation(() => fixedDate)

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue({ taskId: 'current-task' })

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockTasksCollection.findOne).toHaveBeenCalledWith({
          userSessionId: 'test-session-123',
          startTime: { $lte: fixedDate },
          endTime: { $gte: fixedDate }
        })
      })
    })

    describe('Rating System', () => {
      it('should set rating to like when configured', async () => {
        config.explanation_rating = 'like'

        const engine = await setupExplanationEngine(mockDb, config)
        explanationCallback = engine.explanationCallback

        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockSocket.emit).toHaveBeenCalledWith('explanation', 
          expect.objectContaining({
            rating: 'like'
          })
        )
      })

      it('should set rating to null for other values', async () => {
        config.explanation_rating = 'stars'

        const engine = await setupExplanationEngine(mockDb, config)
        explanationCallback = engine.explanationCallback

        const userData = {
          sessionId: 'test-session-123',
          socketId: 'socket-456'
        }

        mockSessionsCollection.findOne.mockResolvedValue(userData)
        mockTasksCollection.findOne.mockResolvedValue(null)

        const explanationData = {
          user_id: 'test-session-123',
          explanation: 'Test explanation'
        }

        await explanationCallback(explanationData)

        expect(mockSocket.emit).toHaveBeenCalledWith('explanation', 
          expect.objectContaining({
            rating: null
          })
        )
      })
    })
  })

  describe('Integration Tests', () => {
    it('should complete full workflow for WebSocket engine with automatic explanations', async () => {
      const config = {
        explanation_engine: 'external',
        external_explanation_engine: {
          external_engine_type: 'ws',
          external_explanation_engine_api: 'ws://localhost:5000'
        },
        explanation_trigger: 'automatic',
        explanation_rating: 'like'
      }

      const userData = {
        sessionId: 'integration-test-session',
        socketId: 'integration-socket'
      }

      const currentTask = {
        taskId: 'integration-task'
      }

      mockSessionsCollection.findOne.mockResolvedValue(userData)
      mockTasksCollection.findOne.mockResolvedValue(currentTask)

      const engine = await setupExplanationEngine(mockDb, config)
      
      expect(engine).toBeDefined()
      expect(engine.type).toBe('WebSocket')

      await engine.explanationCallback({
        user_id: 'integration-test-session',
        explanation: 'Integration test explanation'
      })

      expect(mockExplanationsCollection.insertOne).toHaveBeenCalled()
      expect(mockSocket.emit).toHaveBeenCalledWith('explanation', {
        explanation: 'Integration test explanation',
        explanation_id: 'test-uuid-123',
        rating: 'like'
      })
    })

    it('should complete full workflow for REST engine with on-demand explanations', async () => {
      const config = {
        explanation_engine: 'external',
        external_explanation_engine: {
          external_engine_type: 'rest',
          external_explanation_engine_api: 'http://localhost:5000'
        },
        explanation_trigger: 'on_demand',
        explanation_rating: null
      }

      const userData = {
        sessionId: 'rest-test-session',
        socketId: 'rest-socket'
      }

      mockSessionsCollection.findOne.mockResolvedValue(userData)
      mockTasksCollection.findOne.mockResolvedValue(null)

      const engine = await setupExplanationEngine(mockDb, config)
      
      expect(engine).toBeDefined()
      expect(engine.type).toBe('REST')

      await engine.explanationCallback({
        user_id: 'rest-test-session',
        explanation: 'REST test explanation'
      })

      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { sessionId: 'rest-test-session' },
        { $set: { explanation_cache: expect.any(Object) } }
      )
      expect(mockExplanationsCollection.insertOne).not.toHaveBeenCalled()
    })
  })
})