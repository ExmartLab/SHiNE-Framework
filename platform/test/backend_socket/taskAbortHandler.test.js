import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleTaskAbort } from '../../src/lib/server/socket/taskAbortHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock dependencies
vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  createLogger: vi.fn(() => ({
    logTaskAbort: vi.fn(),
    logTaskBegin: vi.fn()
  })),
  updateSubsequentTasks: vi.fn(() => Promise.resolve({
    subsequentTask: null,
    updatedProperties: []
  })),
  getUpdatedTasksWithMetadata: vi.fn(() => Promise.resolve([]))
}))

describe('Task Abort Handler', () => {
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
      findOne: vi.fn(() => Promise.resolve({
        userSessionId: 'test-session',
        taskId: 'task-1',
        startTime: new Date(Date.now() - 5000), // 5 seconds ago
        task_order: 1,
        isAborted: false
      }))
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

  it('should successfully abort a task', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskAbort: vi.fn(),
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue(mockLogger)
    updateSubsequentTasks.mockResolvedValue({
      subsequentTask: { taskId: 'task-2' },
      updatedProperties: []
    })
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    const gameUpdatePromise = testHarness.waitForEvent(testHarness.clientSocket, 'game-update')

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'test-session')
    expect(mockTasksCollection.findOne).toHaveBeenCalledWith({ 
      userSessionId: 'test-session', 
      taskId: 'task-1' 
    })
    expect(mockLogger.logTaskAbort).toHaveBeenCalledWith('task-1', 'too_difficult')
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      {
        userSessionId: 'test-session',
        taskId: 'task-1',
        isAborted: false
      },
      {
        $set: {
          isAborted: true,
          endTime: expect.any(Date),
          abortedReason: 'too_difficult',
          duration: expect.any(Number)
        }
      }
    )

    const gameUpdate = await gameUpdatePromise
    expect(gameUpdate).toHaveProperty('message', 'You aborted a task!')
    expect(gameUpdate).toHaveProperty('sessionId', 'test-session')
  })

  it('should exit early if required data is missing - sessionId', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: null,
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if required data is missing - taskId', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: 'test-session',
      taskId: undefined,
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if required data is missing - abortOption', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: ''
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if session validation fails', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session',
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(mockTasksCollection.findOne).not.toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if task is not found', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    mockTasksCollection.findOne.mockResolvedValue(null)

    const testData = {
      sessionId: 'test-session',
      taskId: 'non-existent-task',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(mockTasksCollection.findOne).toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if task update fails (already aborted)', async () => {
    // Arrange
    const { validateSession, createLogger } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue({
      logTaskAbort: vi.fn(),
      logTaskBegin: vi.fn()
    })
    
    // Mock task update returning no matches (task already aborted)
    mockTasksCollection.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 })

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.updateOne).toHaveBeenCalled()
    // Should not proceed to subsequent tasks update when update fails
    const { updateSubsequentTasks } = await import('../../src/lib/server/services/commonServices.js')
    expect(updateSubsequentTasks).not.toHaveBeenCalled()
  })

  it('should handle different abort options', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskAbort: vi.fn(),
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue(mockLogger)
    updateSubsequentTasks.mockResolvedValue({
      subsequentTask: null,
      updatedProperties: []
    })
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: 'not_interested'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logTaskAbort).toHaveBeenCalledWith('task-1', 'not_interested')
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          abortedReason: 'not_interested'
        })
      }
    )
  })

  it('should calculate task duration correctly', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    const fixedStartTime = new Date(Date.now() - 10000) // 10 seconds ago
    mockTasksCollection.findOne.mockResolvedValue({
      userSessionId: 'test-session',
      taskId: 'task-1',
      startTime: fixedStartTime,
      task_order: 1,
      isAborted: false
    })
    
    const mockLogger = {
      logTaskAbort: vi.fn(),
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue(mockLogger)
    updateSubsequentTasks.mockResolvedValue({
      subsequentTask: null,
      updatedProperties: []
    })
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          duration: expect.any(Number)
        })
      }
    )
    
    // Check that duration is reasonable (around 10 seconds, allowing for test execution time)
    const updateCall = mockTasksCollection.updateOne.mock.calls[0]
    const duration = updateCall[1].$set.duration
    expect(duration).toBeGreaterThan(9)
    expect(duration).toBeLessThan(12)
  })

  it('should log subsequent task begin when next task exists', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskAbort: vi.fn(),
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue(mockLogger)
    updateSubsequentTasks.mockResolvedValue({
      subsequentTask: { taskId: 'task-2' },
      updatedProperties: []
    })
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logTaskBegin).toHaveBeenCalledWith('task-2')
  })

  it('should not log subsequent task begin when no next task exists', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskAbort: vi.fn(),
      logTaskBegin: vi.fn()
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue(mockLogger)
    updateSubsequentTasks.mockResolvedValue({
      subsequentTask: null,
      updatedProperties: []
    })
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1',
      abortOption: 'too_difficult'
    }

    // Act
    await handleTaskAbort(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logTaskBegin).not.toHaveBeenCalled()
  })
})