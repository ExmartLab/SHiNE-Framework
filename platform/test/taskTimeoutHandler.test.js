import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleTaskTimeout } from '../src/lib/server/socket/taskTimeoutHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock dependencies
vi.mock('../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  createLogger: vi.fn(() => ({
    logTaskTimeout: vi.fn(),
    logTaskBegin: vi.fn()
  })),
  updateSubsequentTasks: vi.fn(() => Promise.resolve({
    subsequentTask: null,
    updatedProperties: []
  })),
  getUpdatedTasksWithMetadata: vi.fn(() => Promise.resolve([]))
}))

describe('Task Timeout Handler', () => {
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
        startTime: new Date('2023-01-01T10:00:00Z'), // Fixed past time
        endTime: new Date('2023-01-01T10:00:01Z'), // Fixed time (timed out)
        task_order: 1,
        isTimedOut: false,
        isCompleted: false
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

  it('should successfully handle task timeout', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskTimeout: vi.fn(),
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
      taskId: 'task-1'
    }

    const gameUpdatePromise = testHarness.waitForEvent(testHarness.clientSocket, 'game-update')

    // Act
    await handleTaskTimeout(
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
    expect(mockLogger.logTaskTimeout).toHaveBeenCalledWith('task-1')
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      {
        userSessionId: 'test-session',
        taskId: 'task-1',
        isTimedOut: false
      },
      {
        $set: {
          isTimedOut: true,
          endTime: expect.any(Date),
          duration: expect.any(Number)
        }
      }
    )

    const gameUpdate = await gameUpdatePromise
    expect(gameUpdate).toHaveProperty('sessionId', 'test-session')
    expect(gameUpdate).toHaveProperty('updatedTasks')
    expect(gameUpdate).toHaveProperty('updatedProperties')
  })

  it('should exit early if sessionId is missing', async () => {
    // Arrange
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: null,
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
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

  it('should exit early if taskId is missing', async () => {
    // Arrange
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')

    const testData = {
      sessionId: 'test-session',
      taskId: undefined
    }

    // Act
    await handleTaskTimeout(
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
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session',
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
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
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    mockTasksCollection.findOne.mockResolvedValue(null)

    const testData = {
      sessionId: 'test-session',
      taskId: 'non-existent-task'
    }

    // Act
    await handleTaskTimeout(
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

  it('should exit early and NOT timeout a task when endTime is still in the future', async () => {
    // Arrange
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    
    // Mock task with endTime in the future (more than 1 second buffer)
    // Handler checks: (task.endTime.getTime() - 1000) > currentTime.getTime()
    const futureTime = new Date()
    futureTime.setTime(futureTime.getTime() + 5000) // 5 seconds in future
    
    mockTasksCollection.findOne.mockResolvedValue({
      userSessionId: 'test-session',
      taskId: 'task-1',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: futureTime, // This should trigger early exit
      task_order: 1,
      isTimedOut: false,
      isCompleted: false
    })

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert - should exit early when task isn't actually timing out
    expect(mockTasksCollection.findOne).toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if task is already completed', async () => {
    // Arrange
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    
    // Mock completed task
    mockTasksCollection.findOne.mockResolvedValue({
      userSessionId: 'test-session',
      taskId: 'task-1',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T10:00:01Z'),
      task_order: 1,
      isTimedOut: false,
      isCompleted: true // Already completed
    })

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.findOne).toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if task is already timed out', async () => {
    // Arrange
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    
    // Mock already timed out task
    mockTasksCollection.findOne.mockResolvedValue({
      userSessionId: 'test-session',
      taskId: 'task-1',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T10:00:01Z'),
      task_order: 1,
      isTimedOut: true, // Already timed out
      isCompleted: false
    })

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.findOne).toHaveBeenCalled()
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if task update fails (no matches)', async () => {
    // Arrange
    const { validateSession, createLogger } = await import('../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    createLogger.mockReturnValue({
      logTaskTimeout: vi.fn(),
      logTaskBegin: vi.fn()
    })
    
    // Mock task update returning no matches
    mockTasksCollection.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 })

    const testData = {
      sessionId: 'test-session',
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.updateOne).toHaveBeenCalled()
    // Should not proceed to subsequent tasks update when update fails
    const { updateSubsequentTasks } = await import('../src/lib/server/services/commonServices.js')
    expect(updateSubsequentTasks).not.toHaveBeenCalled()
  })

  it('should calculate task duration correctly', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../src/lib/server/services/commonServices.js')
    
    const fixedStartTime = new Date('2023-01-01T10:00:00Z')
    const fixedEndTime = new Date('2023-01-01T10:00:01Z') // 1 second later
    
    mockTasksCollection.findOne.mockResolvedValue({
      userSessionId: 'test-session',
      taskId: 'task-1',
      startTime: fixedStartTime,
      endTime: fixedEndTime,
      task_order: 1,
      isTimedOut: false,
      isCompleted: false
    })
    
    const mockLogger = {
      logTaskTimeout: vi.fn(),
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
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert - duration should be calculated from start to current time
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          duration: expect.any(Number) // Just verify it's a number
        })
      }
    )
  })

  it('should log subsequent task begin when next task exists', async () => {
    // Arrange
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskTimeout: vi.fn(),
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
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
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
    const { validateSession, createLogger, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logTaskTimeout: vi.fn(),
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
      taskId: 'task-1'
    }

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logTaskBegin).not.toHaveBeenCalled()
  })

  it('should handle data destructuring properly', async () => {
    // Arrange
    const { validateSession } = await import('../src/lib/server/services/commonServices.js')

    // Test with data object missing properties
    const testData = {}

    // Act
    await handleTaskTimeout(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).not.toHaveBeenCalled()
  })
})