import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleGameStart } from '../../src/lib/server/socket/gameStartHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock dependencies
vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  getCurrentTask: vi.fn(),
  createLogger: vi.fn(() => ({
    logTaskBegin: vi.fn()
  }))
}))

describe('Game Start Handler', () => {
  let testHarness
  let mockDb
  let mockLogsCollection
  let mockTasksCollection
  let mockSessionsCollection
  let mockGameConfig
  let mockExplanationEngine

  beforeEach(async () => {
    testHarness = new SocketTestHarness()
    await testHarness.setup()

    // Create mock collection methods
    mockLogsCollection = {
      find: vi.fn(() => ({ 
        toArray: vi.fn(() => Promise.resolve([])) 
      })),
      insertOne: vi.fn(() => Promise.resolve()),
      updateOne: vi.fn(() => Promise.resolve()),
      findOne: vi.fn(() => Promise.resolve())
    }
    
    mockTasksCollection = {
      updateOne: vi.fn(() => Promise.resolve()),
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
          case 'logs': return mockLogsCollection
          case 'tasks': return mockTasksCollection
          case 'sessions': return mockSessionsCollection
          default: return mockLogsCollection
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

  it('should successfully start game and log task begin', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'test-session')
    expect(mockLogsCollection.find).toHaveBeenCalledWith({ userSessionId: 'test-session' })
    expect(getCurrentTask).toHaveBeenCalledWith(mockDb, 'test-session')
    expect(createLogger).toHaveBeenCalledWith(mockDb, 'test-session', mockGameConfig, mockExplanationEngine)
    expect(mockLogger.logTaskBegin).toHaveBeenCalledWith('task-1')
  })

  it('should exit early if sessionId is missing', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: null
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockLogsCollection.find).not.toHaveBeenCalled()
  })

  it('should exit early if sessionId is undefined', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: undefined
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockLogsCollection.find).not.toHaveBeenCalled()
  })

  it('should exit early if sessionId is empty string', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: ''
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockLogsCollection.find).not.toHaveBeenCalled()
  })

  it('should exit early if session validation fails', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'invalid-session')
    expect(mockLogsCollection.find).not.toHaveBeenCalled()
    expect(getCurrentTask).not.toHaveBeenCalled()
  })

  it('should exit early if logs already exist (duplicate game start prevention)', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    
    // Mock existing logs
    mockLogsCollection.find.mockReturnValue({
      toArray: vi.fn(() => Promise.resolve([
        { userSessionId: 'test-session', event: 'task_begin', timestamp: new Date() }
      ]))
    })

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(mockLogsCollection.find).toHaveBeenCalledWith({ userSessionId: 'test-session' })
    expect(getCurrentTask).not.toHaveBeenCalled()
  })

  it('should exit early if current task is not found', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue(null)

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(mockLogsCollection.find).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalledWith(mockDb, 'test-session')
    expect(createLogger).not.toHaveBeenCalled()
  })

  it('should handle different task IDs correctly', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'custom-task-123', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logTaskBegin).toHaveBeenCalledWith('custom-task-123')
  })

  it('should handle database errors gracefully when checking logs', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    
    // Mock database error when fetching logs
    mockLogsCollection.find.mockReturnValue({
      toArray: vi.fn(() => Promise.reject(new Error('Database connection failed')))
    })

    const testData = {
      sessionId: 'test-session'
    }

    // Act & Assert - should throw the database error
    await expect(handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )).rejects.toThrow('Database connection failed')

    expect(validateSession).toHaveBeenCalled()
    expect(mockLogsCollection.find).toHaveBeenCalled()
    expect(getCurrentTask).not.toHaveBeenCalled()
  })

  it('should handle missing data object gracefully', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    // Act - passing undefined as data
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      undefined,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockLogsCollection.find).not.toHaveBeenCalled()
  })

  it('should handle empty logs array correctly (fresh game start)', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)
    
    // Explicitly mock empty logs array
    mockLogsCollection.find.mockReturnValue({
      toArray: vi.fn(() => Promise.resolve([]))
    })

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogsCollection.find).toHaveBeenCalledWith({ userSessionId: 'test-session' })
    expect(getCurrentTask).toHaveBeenCalled()
    expect(mockLogger.logTaskBegin).toHaveBeenCalledWith('task-1')
  })

  it('should handle logger creation with all parameters', async () => {
    // Arrange
    const { validateSession, getCurrentTask, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })
    createLogger.mockReturnValue(mockLogger)

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleGameStart(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(createLogger).toHaveBeenCalledWith(
      mockDb, 
      'test-session', 
      mockGameConfig, 
      mockExplanationEngine
    )
  })
})