import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/lib/server/logger/metadata.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    generateMetadata: vi.fn()
  }))
}))

const { default: Logger } = await vi.importActual('../../src/lib/server/logger/logger.js')

describe('Logger', () => {
  let mockDb
  let mockLogsCollection
  let mockSessionId
  let mockMetadataEngine
  let mockExplanationEngine
  let logger

  beforeEach(() => {
    // Create mock collections
    mockLogsCollection = {
      insertOne: vi.fn(() => Promise.resolve()),
      find: vi.fn(() => ({ toArray: vi.fn(() => []) }))
    }

    mockDb = {
      collection: vi.fn((collectionName) => {
        if (collectionName === 'logs') return mockLogsCollection
        return { findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn() }
      })
    }

    mockSessionId = 'test-session-123'

    mockMetadataEngine = {
      generateMetadata: vi.fn(() => Promise.resolve({
        user_id: mockSessionId,
        current_task: 'task-1',
        ingame_time: '09:00',
        environment: [],
        devices: [],
        logs: []
      }))
    }

    mockExplanationEngine = {
      getType: vi.fn(() => 'REST'),
      logData: vi.fn(() => Promise.resolve())
    }

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with required parameters', () => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine)
      
      expect(logger.dbConn).toBe(mockDb)
      expect(logger.sessionId).toBe(mockSessionId)
      expect(logger.metadataEngine).toBe(mockMetadataEngine)
      expect(logger.explanationEngine).toBe(null)
    })

    it('should initialize with optional explanation engine', () => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      
      expect(logger.dbConn).toBe(mockDb)
      expect(logger.sessionId).toBe(mockSessionId)
      expect(logger.metadataEngine).toBe(mockMetadataEngine)
      expect(logger.explanationEngine).toBe(mockExplanationEngine)
    })
  })

  describe('logRuleTrigger', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log rule trigger with correct format', async () => {
      const ruleId = 'rule-123'
      const ruleAction = 'turn_on_light'

      await logger.logRuleTrigger(ruleId, ruleAction)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RULE_TRIGGER',
          metadata: {
            rule_id: ruleId,
            rule_action: ruleAction
          },
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RULE_TRIGGER',
          metadata: {
            rule_id: ruleId,
            rule_action: ruleAction
          },
          timestamp: expect.any(Number)
        })
      )
    })

    it('should generate timestamp as Unix timestamp', async () => {
      const beforeTime = Math.floor(new Date().getTime() / 1000)
      await logger.logRuleTrigger('rule-123', 'action')
      const afterTime = Math.floor(new Date().getTime() / 1000)

      const logCall = logger.saveLogToDB.mock.calls[0][0]
      expect(logCall.timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(logCall.timestamp).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('logGameInteraction', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log game interaction with correct format', async () => {
      const interactionType = 'DEVICE_CLICK'
      const interactionData = { deviceId: 'device-123', action: 'toggle' }

      await logger.logGameInteraction(interactionType, interactionData)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: interactionType,
          metadata: interactionData,
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: interactionType,
          metadata: interactionData,
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('logTaskCompleted', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log task completion with correct format', async () => {
      const taskId = 'task-456'

      await logger.logTaskCompleted(taskId)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_COMPLETED',
          metadata: { task_id: taskId },
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_COMPLETED',
          metadata: { task_id: taskId },
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('logTaskTimeout', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log task timeout with correct format', async () => {
      const taskId = 'task-789'

      await logger.logTaskTimeout(taskId)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_TIMEOUT',
          metadata: { task_id: taskId },
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_TIMEOUT',
          metadata: { task_id: taskId },
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('logTaskBegin', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log task begin with correct format', async () => {
      const taskId = 'task-begin-123'

      await logger.logTaskBegin(taskId)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_BEGIN',
          metadata: { task_id: taskId },
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_BEGIN',
          metadata: { task_id: taskId },
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('logTaskAbort', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log task abort with correct format', async () => {
      const taskId = 'task-abort-123'
      const abortReason = 'user_requested'

      await logger.logTaskAbort(taskId, abortReason)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ABORT_TASK',
          metadata: { task_id: taskId, abort_reason: abortReason },
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ABORT_TASK',
          metadata: { task_id: taskId, abort_reason: abortReason },
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('logDeviceInteraction', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      vi.spyOn(logger, 'notifyExplanationEngine').mockResolvedValue()
      vi.spyOn(logger, 'saveLogToDB').mockResolvedValue()
    })

    it('should log device interaction with correct format', async () => {
      const metadata = { deviceId: 'device-456', property: 'brightness', value: 75 }

      await logger.logDeviceInteraction(metadata)

      expect(logger.notifyExplanationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEVICE_INTERACTION',
          metadata: metadata,
          timestamp: expect.any(Number)
        })
      )

      expect(logger.saveLogToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEVICE_INTERACTION',
          metadata: metadata,
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('saveLogToDB', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
    })

    it('should add session ID to log and save to database', async () => {
      const log = {
        type: 'TEST_LOG',
        metadata: { test: 'data' },
        timestamp: 1234567890
      }

      await logger.saveLogToDB(log)

      expect(mockLogsCollection.insertOne).toHaveBeenCalledWith({
        type: 'TEST_LOG',
        metadata: { test: 'data' },
        timestamp: 1234567890,
        user_session_id: mockSessionId
      })
    })

    it('should call correct collection', async () => {
      const log = { type: 'TEST_LOG', metadata: {}, timestamp: 1234567890 }

      await logger.saveLogToDB(log)

      expect(mockDb.collection).toHaveBeenCalledWith('logs')
    })
  })

  describe('notifyExplanationEngine', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
    })

    it('should return early if explanation engine is null', async () => {
      logger.explanationEngine = null
      const log = { type: 'TEST_LOG', metadata: {}, timestamp: 1234567890 }

      await logger.notifyExplanationEngine(log)

      expect(mockMetadataEngine.generateMetadata).not.toHaveBeenCalled()
    })

    it('should handle REST explanation engine type', async () => {
      mockExplanationEngine.getType.mockReturnValue('REST')
      const existingLogs = [
        { type: 'OLD_LOG', metadata: {}, timestamp: 1234567880, _id: 'mongo-id', user_session_id: mockSessionId }
      ]
      mockLogsCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.resolve(existingLogs)) })

      const log = { type: 'NEW_LOG', metadata: {}, timestamp: 1234567890 }

      await logger.notifyExplanationEngine(log)

      expect(mockMetadataEngine.generateMetadata).toHaveBeenCalled()
      expect(mockLogsCollection.find).toHaveBeenCalledWith({ user_session_id: mockSessionId })
      expect(mockExplanationEngine.logData).toHaveBeenCalledWith(
        expect.objectContaining({
          logs: [
            { type: 'OLD_LOG', metadata: {}, timestamp: 1234567880 },
            log
          ]
        })
      )
    })

    it('should handle WEBSOCKET explanation engine type', async () => {
      mockExplanationEngine.getType.mockReturnValue('WEBSOCKET')
      const log = { type: 'NEW_LOG', metadata: {}, timestamp: 1234567890 }

      await logger.notifyExplanationEngine(log)

      expect(mockMetadataEngine.generateMetadata).toHaveBeenCalled()
      expect(mockExplanationEngine.logData).toHaveBeenCalledWith(
        expect.objectContaining({
          log: log
        })
      )
    })

    it('should handle case-insensitive explanation engine type', async () => {
      mockExplanationEngine.getType.mockReturnValue('rEsT')
      const log = { type: 'NEW_LOG', metadata: {}, timestamp: 1234567890 }

      await logger.notifyExplanationEngine(log)

      expect(mockExplanationEngine.logData).toHaveBeenCalled()
    })

    it('should remove _id and user_session_id from existing logs for REST type', async () => {
      mockExplanationEngine.getType.mockReturnValue('REST')
      const existingLogs = [
        { type: 'LOG1', metadata: {}, timestamp: 1234567880, _id: 'id1', user_session_id: mockSessionId },
        { type: 'LOG2', metadata: {}, timestamp: 1234567881, _id: 'id2', user_session_id: mockSessionId }
      ]
      mockLogsCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.resolve(existingLogs)) })

      const log = { type: 'NEW_LOG', metadata: {}, timestamp: 1234567890 }

      await logger.notifyExplanationEngine(log)

      const callArgs = mockExplanationEngine.logData.mock.calls[0][0]
      expect(callArgs.logs[0]).not.toHaveProperty('_id')
      expect(callArgs.logs[0]).not.toHaveProperty('user_session_id')
      expect(callArgs.logs[1]).not.toHaveProperty('_id')
      expect(callArgs.logs[1]).not.toHaveProperty('user_session_id')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
    })

    it('should handle database errors in saveLogToDB', async () => {
      const dbError = new Error('Database connection failed')
      mockLogsCollection.insertOne.mockRejectedValue(dbError)

      const log = { type: 'TEST_LOG', metadata: {}, timestamp: 1234567890 }

      await expect(logger.saveLogToDB(log)).rejects.toThrow('Database connection failed')
    })

    it('should handle metadata generation errors', async () => {
      const metadataError = new Error('Metadata generation failed')
      mockMetadataEngine.generateMetadata.mockRejectedValue(metadataError)

      const log = { type: 'TEST_LOG', metadata: {}, timestamp: 1234567890 }

      await expect(logger.notifyExplanationEngine(log)).rejects.toThrow('Metadata generation failed')
    })

    it('should handle explanation engine errors', async () => {
      const explanationError = new Error('Explanation engine failed')
      mockExplanationEngine.logData.mockRejectedValue(explanationError)

      const log = { type: 'TEST_LOG', metadata: {}, timestamp: 1234567890 }

      await expect(logger.notifyExplanationEngine(log)).rejects.toThrow('Explanation engine failed')
    })

    it('should handle errors in log retrieval for REST type', async () => {
      mockExplanationEngine.getType.mockReturnValue('REST')
      const dbError = new Error('Log retrieval failed')
      mockLogsCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.reject(dbError)) })

      const log = { type: 'NEW_LOG', metadata: {}, timestamp: 1234567890 }

      await expect(logger.notifyExplanationEngine(log)).rejects.toThrow('Log retrieval failed')
    })
  })

  describe('Integration Tests', () => {
    it('should complete full logging workflow', async () => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, mockExplanationEngine)
      
      const taskId = 'integration-task-123'
      
      await logger.logTaskBegin(taskId)

      expect(mockMetadataEngine.generateMetadata).toHaveBeenCalled()
      expect(mockExplanationEngine.logData).toHaveBeenCalled()
      expect(mockLogsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_BEGIN',
          metadata: { task_id: taskId },
          user_session_id: mockSessionId,
          timestamp: expect.any(Number)
        })
      )
    })

    it('should work without explanation engine', async () => {
      logger = new Logger(mockDb, mockSessionId, mockMetadataEngine, null)
      
      const ruleId = 'no-explanation-rule'
      const ruleAction = 'test-action'
      
      await logger.logRuleTrigger(ruleId, ruleAction)

      expect(mockLogsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RULE_TRIGGER',
          metadata: { rule_id: ruleId, rule_action: ruleAction },
          user_session_id: mockSessionId,
          timestamp: expect.any(Number)
        })
      )
    })
  })
})