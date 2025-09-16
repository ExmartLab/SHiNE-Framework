import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleDeviceInteraction } from '../../src/lib/server/socket/deviceInteractionHandler.js'
import { SocketTestHarness } from './socketTestUtils.js'

// Mock dependencies
vi.mock('../../src/lib/server/deviceUtils.js', () => ({
  updateDeviceInteraction: vi.fn(() => Promise.resolve({ id: 'test-interaction' })),
  isStatelessAction: vi.fn(() => false)
}))

vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  validateSession: vi.fn(),
  getCurrentTask: vi.fn(),
  createLogger: vi.fn(() => ({
    logDeviceInteraction: vi.fn(),
    logTaskCompleted: vi.fn(),
    logTaskBegin: vi.fn()
  })),
  checkTaskGoals: vi.fn(),
  updateSubsequentTasks: vi.fn(() => Promise.resolve({
    subsequentTask: null,
    updatedProperties: []
  })),
  getUpdatedTasksWithMetadata: vi.fn(() => Promise.resolve([]))
}))

vi.mock('../../src/lib/server/services/rulesService.js', () => ({
  evaluateRules: vi.fn(() => Promise.resolve({
    updated_properties: [],
    explanations: []
  }))
}))

describe('Device Interaction Handler', () => {
  let testHarness
  let mockDb
  let mockTasksCollection
  let mockSessionsCollection
  let mockDevicesCollection
  let mockExplanationsCollection
  let mockGameConfig
  let mockExplanationConfig
  let mockExplanationEngine

  beforeEach(async () => {
    testHarness = new SocketTestHarness()
    await testHarness.setup()

    // Create mock collection methods
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
    
    mockDevicesCollection = {
      updateOne: vi.fn(() => Promise.resolve()),
      insertOne: vi.fn(() => Promise.resolve()),
      find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
      findOne: vi.fn(() => Promise.resolve())
    }
    
    mockExplanationsCollection = {
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
          case 'devices': return mockDevicesCollection
          case 'explanations': return mockExplanationsCollection
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

    mockExplanationConfig = {
      explanation_trigger: 'push',
      explanation_rating: 'like'
    }

    mockExplanationEngine = {}
  })

  afterEach(async () => {
    await testHarness.cleanup()
    vi.clearAllMocks()
  })

  it('should handle valid device interaction', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalledWith(testHarness.serverSocket, mockDb, 'test-session')
    expect(getCurrentTask).toHaveBeenCalledWith(mockDb, 'test-session')
    expect(mockDb.collection).toHaveBeenCalledWith('tasks')
  })

  it('should exit early if session validation fails', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue(null)

    const testData = {
      sessionId: 'invalid-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).not.toHaveBeenCalled()
  })

  it('should emit game-update when task goals are met', async () => {
    // Arrange
    const { validateSession, getCurrentTask, checkTaskGoals, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })
    checkTaskGoals.mockReturnValue(true)
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    const gameUpdatePromise = testHarness.waitForEvent(testHarness.clientSocket, 'game-update')

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert  
    const gameUpdate = await gameUpdatePromise
    expect(gameUpdate).toHaveProperty('message', 'You completed a task!')
    expect(gameUpdate).toHaveProperty('sessionId', 'test-session')
  })

  it('should exit early if current task is not found', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue(null)

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(validateSession).toHaveBeenCalled()
    expect(getCurrentTask).toHaveBeenCalled()
    // Should not proceed to database updates when no current task
    expect(mockTasksCollection.updateOne).not.toHaveBeenCalled()
  })

  it('should handle rule evaluation with delayed device updates', async () => {
    // Arrange
    const { validateSession, getCurrentTask, checkTaskGoals } = await import('../../src/lib/server/services/commonServices.js')
    const { evaluateRules } = await import('../../src/lib/server/services/rulesService.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })
    checkTaskGoals.mockReturnValue(false)
    
    evaluateRules.mockResolvedValue({
      updated_properties: [{
        sessionId: 'test-session',
        deviceId: 'light-2',
        interaction: 'brightness',
        value: 50,
        delay: 2
      }],
      explanations: []
    })

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    const updateInteractionPromise = testHarness.waitForEvent(testHarness.clientSocket, 'update-interaction')

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert - should receive delayed update
    const updateInteraction = await updateInteractionPromise
    expect(updateInteraction).toHaveProperty('deviceId', 'light-2')
    expect(updateInteraction).toHaveProperty('value', 50)
  }, 15000)

  it('should handle push explanations with immediate trigger', async () => {
    // Arrange
    const { validateSession, getCurrentTask, checkTaskGoals } = await import('../../src/lib/server/services/commonServices.js')
    const { evaluateRules } = await import('../../src/lib/server/services/rulesService.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })
    checkTaskGoals.mockReturnValue(false)
    
    evaluateRules.mockResolvedValue({
      updated_properties: [],
      explanations: [{
        explanation_id: 'exp-1',
        explanation: 'The light turned on because of the motion sensor',
        delay: 0
      }]
    })

    const testData = {
      sessionId: 'test-session',
      device: 'motion-sensor',
      interaction: 'trigger',
      value: true
    }

    const explanationPromise = testHarness.waitForEvent(testHarness.clientSocket, 'explanation')

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    const explanation = await explanationPromise
    expect(explanation).toHaveProperty('explanation', 'The light turned on because of the motion sensor')
    expect(explanation).toHaveProperty('explanation_id', 'exp-1')
    expect(explanation).toHaveProperty('rating', 'like')
  })

  it('should cache explanations for on-demand trigger', async () => {
    // Arrange
    const { validateSession, getCurrentTask, checkTaskGoals } = await import('../../src/lib/server/services/commonServices.js')
    const { evaluateRules } = await import('../../src/lib/server/services/rulesService.js')
    
    const mockExplanationConfigOnDemand = {
      explanation_trigger: 'pull',
      explanation_rating: 'none'
    }
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })
    checkTaskGoals.mockReturnValue(false)
    
    evaluateRules.mockResolvedValue({
      updated_properties: [],
      explanations: [{
        explanation_id: 'exp-1',
        explanation: 'Cached explanation',
        delay: 0
      }]
    })

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfigOnDemand,
      mockExplanationEngine
    )

    // Assert - explanation should be cached in session, not emitted
    expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
      { sessionId: 'test-session' },
      { $set: { explanation_cache: expect.objectContaining({ explanation_id: 'exp-1' }) } }
    )
  })

  it('should increment interaction counter for each device interaction', async () => {
    // Arrange
    const { validateSession, getCurrentTask, checkTaskGoals } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })
    checkTaskGoals.mockReturnValue(false)

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      { userSessionId: 'test-session', taskId: 'task-1' },
      { $inc: { interactionTimes: 1 } }
    )
  })

  it('should log task completion and update subsequent tasks when goals are met', async () => {
    // Arrange
    const { validateSession, getCurrentTask, checkTaskGoals, updateSubsequentTasks, getUpdatedTasksWithMetadata } = await import('../../src/lib/server/services/commonServices.js')
    
    const mockLogger = {
      logDeviceInteraction: vi.fn(),
      logTaskCompleted: vi.fn(),
      logTaskBegin: vi.fn()
    }
    
    const { createLogger } = await import('../../src/lib/server/services/commonServices.js')
    createLogger.mockReturnValue(mockLogger)
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'task-1', 
      _id: 'task-obj-id',
      startTime: new Date(Date.now() - 5000), // 5 seconds ago
      task_order: 1
    })
    checkTaskGoals.mockReturnValue(true)
    
    updateSubsequentTasks.mockResolvedValue({
      subsequentTask: { taskId: 'task-2' },
      updatedProperties: []
    })
    getUpdatedTasksWithMetadata.mockResolvedValue([])

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert
    expect(mockLogger.logTaskCompleted).toHaveBeenCalledWith('task-1')
    expect(mockLogger.logTaskBegin).toHaveBeenCalledWith('task-2')
    expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'task-obj-id' },
      { 
        $set: { 
          endTime: expect.any(Date), 
          completionTime: expect.any(Date), 
          isCompleted: true, 
          duration: expect.any(Number)
        } 
      }
    )
  })

  it('should handle missing task details gracefully', async () => {
    // Arrange
    const { validateSession, getCurrentTask } = await import('../../src/lib/server/services/commonServices.js')
    
    validateSession.mockResolvedValue({ sessionId: 'test-session' })
    getCurrentTask.mockResolvedValue({ 
      taskId: 'non-existent-task', 
      _id: 'task-obj-id',
      startTime: new Date(),
      task_order: 1
    })

    const testData = {
      sessionId: 'test-session',
      device: 'light-1',
      interaction: 'toggle',
      value: true
    }

    // Act
    await handleDeviceInteraction(
      testHarness.serverSocket,
      mockDb,
      testData,
      mockGameConfig,
      mockExplanationConfig,
      mockExplanationEngine
    )

    // Assert - should exit early when task detail is not found
    const { evaluateRules } = await import('../../src/lib/server/services/rulesService.js')
    expect(evaluateRules).not.toHaveBeenCalled()
  })
})