import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleGameInteraction } from '../../src/lib/server/socket/gameInteractionHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock dependencies
vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  getCurrentTask: vi.fn(),
  createLogger: vi.fn(() => ({
    logGameInteraction: vi.fn()
  }))
}))

describe('Game Interaction Handler', () => {
  let testHarness
  let mockDb
  let mockTasksCollection
  let mockSessionsCollection
  let mockGameConfig
  let mockExplanationEngine

  beforeEach(async () => {
    testHarness = new SocketTestHarness()
    await testHarness.setup()

    // Create mock collection methods
    mockTasksCollection = {
      updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1, modifiedCount: 1 })),
      insertOne: vi.fn(() => Promise.resolve()),
      find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
      findOne: vi.fn(() => Promise.resolve())
    }
    
    mockSessionsCollection = {
      updateOne: vi.fn(() => Promise.resolve()),
      insertOne: vi.fn(() => Promise.resolve()),
      find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
      findOne: vi.fn(() => Promise.resolve())
    }

    // Mock database with specific collections
    mockDb = {
      collection: vi.fn((name) => {
        switch (name) {
          case 'tasks': return mockTasksCollection
          case 'sessions': return mockSessionsCollection
          default: return mockTasksCollection
        }
      })
    }

    // Mock configurations
    mockGameConfig = {
      tasks: {
        tasks: [
          {
            id: 'task-1',
            goals: [{ deviceId: 'light-1', property: 'state', value: true }]
          }
        ]
      }
    }

    mockExplanationEngine = {}
  })

  afterEach(async () => {
    await testHarness.cleanup()
    vi.clearAllMocks()
  })

  it('should handle game interaction successfully', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session',
      type: 'click',
      data: { x: 100, y: 200, element: 'button' }
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'test-session')
    expect(getCurrentTask).toHaveBeenCalledWith(mockDb, 'test-session')
    expect(createLogger).toHaveBeenCalledWith(mockDb, 'test-session', mockGameConfig, mockExplanationEngine)
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      { userSessionId: 'test-session', taskId: 'task-1' },
      { $inc: { interactionTimes: 1 } }
    )
    expect(mockLogger.logGameInteraction).toHaveBeenCalledWith('click', { x: 100, y: 200, element: 'button' })
  })

  it('should exit early if session validation fails', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session',
      type: 'click',
      data: { x: 100, y: 200 }
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'invalid-session')
    expect(getCurrentTask).not.toHaveBeenCalled()
    expect(createLogger).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if current task is not found', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue(null)

    const testData = {
      sessionId: 'test-session',
      type: 'click',
      data: { x: 100, y: 200 }
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalledWith(mockDb, 'test-session')
    expect(createLogger).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should handle different interaction types', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session',
      type: 'hover',
      data: { target: 'device-123', duration: 1500 }
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logGameInteraction).toHaveBeenCalledWith('hover', { target: 'device-123', duration: 1500 })
  })

  it('should handle interaction with minimal data', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session',
      type: 'keypress',
      data: null
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logGameInteraction).toHaveBeenCalledWith('keypress', null)
    expect(mockTasksCollection.updateOne).toHaveBeenCalled()
  })

  it('should handle interaction with empty data object', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session',
      type: 'scroll',
      data: {}
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logGameInteraction).toHaveBeenCalledWith('scroll', {})
  })

  it('should handle complex interaction data', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const complexData = {
      coordinates: { x: 150, y: 300 },
      timestamp: Date.now(),
      metadata: {
        device: 'smartphone',
        userAgent: 'Mozilla/5.0...',
        sessionInfo: { duration: 12000 }
      },
      sequence: [1, 2, 3, 4, 5]
    }

    const testData = {
      sessionId: 'test-session',
      type: 'complex-interaction',
      data: complexData
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logGameInteraction).toHaveBeenCalledWith('complex-interaction', complexData)
  })

  it('should handle database update errors gracefully', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    // Mock database error
    mockTasksCollection.updateOne.mockRejectedValue(new Error('Database connection failed'))

    const testData = {
      sessionId: 'test-session',
      type: 'click',
      data: { x: 100, y: 200 }
    }

    // Act & Assert - should throw the database error
    await expect(handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )).rejects.toThrow('Database connection failed')

    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalled()
    expect(createLogger).toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).toHaveBeenCalled()
  })

  it('should handle logger errors gracefully', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn().mockRejectedValue(new Error('Logger failed'))
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session',
      type: 'click',
      data: { x: 100, y: 200 }
    }

    // Act & Assert - should throw the logger error
    await expect(handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )).rejects.toThrow('Logger failed')

    expect(mockTasksCollection.updateOne).toHaveBeenCalled()
    expect(mockLogger.logGameInteraction).toHaveBeenCalled()
  })

  it('should handle missing sessionId in data', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    // Mock validateSession to return null for undefined sessionId
    validateSession.mockResolvedValue(null)

    const testData = {
      type: 'click',
      data: { x: 100, y: 200 }
      // Missing sessionId
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, undefined)
    expect(getCurrentTask).not.toHaveBeenCalled()
    expect(createLogger).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should handle different task IDs correctly', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logGameInteraction: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'custom-task-456', 
      _id: 'custom-task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session',
      type: 'drag',
      data: { from: { x: 10, y: 20 }, to: { x: 50, y: 60 } }
    }

    // Act
    await handleGameInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      { userSessionId: 'test-session', taskId: 'custom-task-456' },
      { $inc: { interactionTimes: 1 } }
    )
  })
})