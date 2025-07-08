import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleExplanationRequest } from '../../src/lib/server/socket/explanationRequestHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123')
}))

// Mock dependencies
vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  getCurrentTask: vi.fn()
}))

describe('Explanation Request Handler', () => {
  let testHarness
  let mockDb
  let mockExplanationsCollection
  let mockSessionsCollection
  let mockExplanationConfig
  let mockExplanationEngine

  beforeEach(async () => {
    testHarness = new SocketTestHarness()
    await testHarness.setup()

    // Create mock collection methods
    mockExplanationsCollection = {
      insertOne: vi.fn(() => Promise.resolve({ insertedId: 'explanation-id' })),
      updateOne: vi.fn(() => Promise.resolve()),
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
          case 'sessions': return mockSessionsCollection
          default: return mockExplanationsCollection
        }
      })
    }

    // Mock configurations
    mockExplanationConfig = {
      explanation_engine: 'external',
      explanation_rating: 'like'
    }

    mockExplanationEngine = {
      requestExplanation: vi.fn(),
      getType: vi.fn(() => 'REST')
    }
  })

  afterEach(async () => {
    await testHarness.cleanup()
    vi.clearAllMocks()
  })

  it('should exit early if session validation fails', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session'
    }

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'invalid-session')
    expect(mockExplanationEngine.requestExplanation).not.toHaveBeenCalled()
  })

  it('should use cached explanation when available and no external engine', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    const cachedExplanation = {
      explanation_id: 'cached-exp-123',
      explanation: 'This is a cached explanation',
      userSessionId: 'test-session',
      taskId: 'task-1'
    }
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: cachedExplanation
    })

    const testData = {
      sessionId: 'test-session'
    }

    const explanationConfig = {
      explanation_engine: 'internal', // Not external
      explanation_rating: 'like'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      explanationConfig,
      mockExplanationEngine
    )

    // Assert
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'This is a cached explanation')
    expect(explanation).toHaveProperty('explanation_id', 'cached-exp-123')
    expect(explanation).toHaveProperty('rating', 'like')
    expect(mockExplanationsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation_id: 'cached-exp-123',
        explanation: 'This is a cached explanation',
        created_at: expect.any(Date)
      })
    )
  })

  it('should request explanation from external engine successfully', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })
    getCurrentTask.mockResolvedValue({
      taskId: 'task-1'
    })

    mockExplanationEngine.requestExplanation.mockResolvedValue({
      success: true,
      explanation: 'External engine explanation'
    })

    const testData = {
      sessionId: 'test-session',
      userMessage: 'Why did this happen?'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockExplanationEngine.requestExplanation).toHaveBeenCalledWith('test-session', 'Why did this happen?')
    
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'External engine explanation')
    expect(explanation).toHaveProperty('explanation_id', 'mock-uuid-123')
    expect(explanation).toHaveProperty('rating', 'like')
    
    expect(mockExplanationsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation_id: 'mock-uuid-123',
        explanation: 'External engine explanation',
        userSessionId: 'test-session',
        taskId: 'task-1',
        delay: 0,
        created_at: expect.any(Date)
      })
    )
  })

  it('should handle external engine request without userMessage', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })
    getCurrentTask.mockResolvedValue({
      taskId: 'task-1'
    })

    mockExplanationEngine.requestExplanation.mockResolvedValue({
      success: true,
      explanation: 'External engine explanation'
    })

    const testData = {
      sessionId: 'test-session'
      // No userMessage provided
    }

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockExplanationEngine.requestExplanation).toHaveBeenCalledWith('test-session', null)
  })

  it('should handle external engine failure gracefully', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })

    mockExplanationEngine.requestExplanation.mockResolvedValue({
      success: false,
      explanation: null
    })

    const testData = {
      sessionId: 'test-session'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'There is no explanation available right now.')
    expect(mockExplanationsCollection.insertOne).not.toHaveBeenCalled()
  })

  it('should handle external engine error gracefully', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })

    mockExplanationEngine.requestExplanation.mockRejectedValue(new Error('API Error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const testData = {
      sessionId: 'test-session'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching explanation from external engine:', expect.any(Error))
    
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'There is no explanation available right now.')
    
    consoleSpy.mockRestore()
  })

  it('should return early for websocket type external engine', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })
    getCurrentTask.mockResolvedValue({
      taskId: 'task-1'
    })

    mockExplanationEngine.requestExplanation.mockResolvedValue({
      success: true,
      explanation: 'Websocket explanation'
    })
    mockExplanationEngine.getType.mockReturnValue('Websocket')

    const testData = {
      sessionId: 'test-session'
    }

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockExplanationEngine.requestExplanation).toHaveBeenCalled()
    expect(mockExplanationEngine.getType).toHaveBeenCalled()
    // Should not emit explanation or save to database for websocket type
    expect(mockExplanationsCollection.insertOne).not.toHaveBeenCalled()
  })

  it('should handle missing current task gracefully', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })
    getCurrentTask.mockResolvedValue(null)

    mockExplanationEngine.requestExplanation.mockResolvedValue({
      success: true,
      explanation: 'External engine explanation'
    })

    const testData = {
      sessionId: 'test-session'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'External engine explanation')
    
    expect(mockExplanationsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: '', // Should default to empty string when no current task
      })
    )
  })

  it('should handle different rating configurations', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    const cachedExplanation = {
      explanation_id: 'cached-exp-123',
      explanation: 'This is a cached explanation',
      userSessionId: 'test-session',
      taskId: 'task-1'
    }
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: cachedExplanation
    })

    const testData = {
      sessionId: 'test-session'
    }

    const explanationConfigNoRating = {
      explanation_engine: 'internal',
      explanation_rating: 'none'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      explanationConfigNoRating,
      mockExplanationEngine
    )

    // Assert
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('rating', null)
  })

  it('should handle missing explanation engine when external engine is configured', async () => {
    // Arrange
    const { validateSession } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ 
      sessionId: 'test-session',
      explanation_cache: null
    })

    const testData = {
      sessionId: 'test-session'
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act - passing null as explanation engine
    await handleExplanationRequest(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockExplanationConfig,
      null
    )

    // Assert
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'There is no explanation available right now.')
  })
})