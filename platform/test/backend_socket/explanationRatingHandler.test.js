import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleExplanationRating } from '../../src/lib/server/socket/explanationRatingHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock dependencies
vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  getCurrentTask: vi.fn()
}))

describe('Explanation Rating Handler', () => {
  let testHarness
  let mockDb
  let mockExplanationsCollection
  let mockTasksCollection
  let mockSessionsCollection

  beforeEach(async () => {
    testHarness = new SocketTestHarness()
    await testHarness.setup()

    // Create mock collection methods
    mockExplanationsCollection = {
      updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1, modifiedCount: 1 })),
      insertOne: vi.fn(() => Promise.resolve()),
      find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
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
          case 'explanations': return mockExplanationsCollection
          case 'tasks': return mockTasksCollection
          case 'sessions': return mockSessionsCollection
          default: return mockExplanationsCollection
        }
      })
    }
  })

  afterEach(async () => {
    await testHarness.cleanup()
    vi.clearAllMocks()
  })

  it('should successfully rate an explanation', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-123',
      rating: 'like'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'test-session')
    expect(getCurrentTask).toHaveBeenCalledWith(mockDb, 'test-session')
    expect(mockExplanationsCollection.updateOne).toHaveBeenCalledWith(
      {
        explanation_id: 'exp-123',
        userSessionId: 'test-session'
      },
      {
        $set: {
          rating: 'like'
        }
      }
    )
  })

  it('should exit early if session validation fails', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session',
      explanation_id: 'exp-123',
      rating: 'like'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).not.toHaveBeenCalled()
    expect(mockExplanationsCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if current task is not found', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue(null)

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-123',
      rating: 'like'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalled()
    expect(mockExplanationsCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should handle different rating values', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-456',
      rating: 'dislike'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(mockExplanationsCollection.updateOne).toHaveBeenCalledWith(
      {
        explanation_id: 'exp-456',
        userSessionId: 'test-session'
      },
      {
        $set: {
          rating: 'dislike'
        }
      }
    )
  })

  it('should handle numeric rating values', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-789',
      rating: 5
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(mockExplanationsCollection.updateOne).toHaveBeenCalledWith(
      {
        explanation_id: 'exp-789',
        userSessionId: 'test-session'
      },
      {
        $set: {
          rating: 5
        }
      }
    )
  })

  it('should exit early if explanation_id is missing', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: undefined,
      rating: 'like'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalled()
    expect(mockExplanationsCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if explanation_id is null', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: null,
      rating: 'like'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalled()
    expect(mockExplanationsCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should exit early if explanation_id is empty string', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: '',
      rating: 'like'
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalled()
    expect(mockExplanationsCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should handle database update errors gracefully', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    // Mock database error
    mockExplanationsCollection.updateOne.mockRejectedValue(new Error('Database connection failed'))

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-error',
      rating: 'like'
    }

    // Act & Assert - should not throw
    await expect(handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )).rejects.toThrow('Database connection failed')
  })

  it('should handle null rating values', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-null',
      rating: null
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(mockExplanationsCollection.updateOne).toHaveBeenCalledWith(
      {
        explanation_id: 'exp-null',
        userSessionId: 'test-session'
      },
      {
        $set: {
          rating: null
        }
      }
    )
  })

  it('should handle empty string rating values', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id'
    })

    const testData = {
      sessionId: 'test-session',
      explanation_id: 'exp-empty',
      rating: ''
    }

    // Act
    await handleExplanationRating(
      testHarness.serverSocket,
      mockDb,
      testData
    )

    // Assert
    expect(mockExplanationsCollection.updateOne).toHaveBeenCalledWith(
      {
        explanation_id: 'exp-empty',
        userSessionId: 'test-session'
      },
      {
        $set: {
          rating: ''
        }
      }
    )
  })
})