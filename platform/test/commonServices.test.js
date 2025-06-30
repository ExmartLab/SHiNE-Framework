import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateSession,
  getCurrentTask,
  createLogger,
  updateSubsequentTasks,
  getUpdatedTasksWithMetadata,
  checkTaskGoals,
  getInjectibleVariables,
  getInGameTime
} from '../src/lib/server/services/commonServices.js'

// Mock dependencies
vi.mock('../src/lib/server/deviceUtils.js', () => ({
  searchDeviceAndProperty: vi.fn()
}))

vi.mock('../src/lib/server/logger/metadata.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadUserData: vi.fn()
  }))
}))

vi.mock('../src/lib/server/logger/logger.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    logTaskTimeout: vi.fn()
  }))
}))

describe('Common Services', () => {
  let mockDb
  let mockSocket
  let mockSessionsCollection
  let mockTasksCollection
  let mockDevicesCollection

  beforeEach(() => {
    // Create mock collections
    mockSessionsCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(() => Promise.resolve()),
      insertOne: vi.fn(),
      find: vi.fn(() => ({ toArray: vi.fn(() => []) }))
    }

    mockTasksCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(() => Promise.resolve()),
      insertOne: vi.fn(),
      find: vi.fn(() => ({ toArray: vi.fn(() => []) }))
    }

    mockDevicesCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(() => Promise.resolve()),
      insertOne: vi.fn(),
      find: vi.fn(() => ({ toArray: vi.fn(() => []) }))
    }

    mockDb = {
      collection: vi.fn((name) => {
        switch (name) {
          case 'sessions': return mockSessionsCollection
          case 'tasks': return mockTasksCollection
          case 'devices': return mockDevicesCollection
          default: return mockSessionsCollection
        }
      })
    }

    mockSocket = {
      id: 'socket-123'
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('validateSession', () => {
    it('should return null if sessionId is not provided', async () => {
      const result = await validateSession(mockSocket, mockDb, null)
      expect(result).toBeNull()
      expect(mockSessionsCollection.findOne).not.toHaveBeenCalled()
    })

    it('should return null if session is not found', async () => {
      mockSessionsCollection.findOne.mockResolvedValue(null)

      const result = await validateSession(mockSocket, mockDb, 'invalid-session')
      
      expect(result).toBeNull()
      expect(mockSessionsCollection.findOne).toHaveBeenCalledWith({ sessionId: 'invalid-session' })
    })

    it('should return null if session is completed', async () => {
      mockSessionsCollection.findOne.mockResolvedValue({
        sessionId: 'test-session',
        isCompleted: true,
        socketId: 'old-socket'
      })

      const result = await validateSession(mockSocket, mockDb, 'test-session')
      
      expect(result).toBeNull()
    })

    it('should return session and update socket ID if different', async () => {
      const userSession = {
        sessionId: 'test-session',
        isCompleted: false,
        socketId: 'old-socket'
      }
      mockSessionsCollection.findOne.mockResolvedValue(userSession)

      const result = await validateSession(mockSocket, mockDb, 'test-session')
      
      expect(result).toEqual(userSession)
      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { sessionId: 'test-session' },
        { $set: { socketId: 'socket-123' } }
      )
    })

    it('should return session without updating socket ID if same', async () => {
      const userSession = {
        sessionId: 'test-session',
        isCompleted: false,
        socketId: 'socket-123'
      }
      mockSessionsCollection.findOne.mockResolvedValue(userSession)

      const result = await validateSession(mockSocket, mockDb, 'test-session')
      
      expect(result).toEqual(userSession)
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })
  })

  describe('getCurrentTask', () => {
    it('should return current active task', async () => {
      const currentTask = {
        taskId: 'task-1',
        userSessionId: 'test-session',
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(Date.now() + 1000)
      }
      mockTasksCollection.findOne.mockResolvedValue(currentTask)

      const result = await getCurrentTask(mockDb, 'test-session')
      
      expect(result).toEqual(currentTask)
      expect(mockTasksCollection.findOne).toHaveBeenCalledWith({
        userSessionId: 'test-session',
        startTime: { $lte: expect.any(Date) },
        endTime: { $gte: expect.any(Date) }
      })
    })

    it('should return null if no current task', async () => {
      mockTasksCollection.findOne.mockResolvedValue(null)

      const result = await getCurrentTask(mockDb, 'test-session')
      
      expect(result).toBeNull()
    })
  })

  describe('createLogger', () => {
    it('should create and return logger instance', async () => {
      const Metadata = (await import('../src/lib/server/logger/metadata.js')).default
      const Logger = (await import('../src/lib/server/logger/logger.js')).default

      const gameConfig = { test: 'config' }
      const explanationEngine = { test: 'engine' }

      const result = await createLogger(mockDb, 'test-session', gameConfig, explanationEngine)

      expect(Metadata).toHaveBeenCalledWith(mockDb, gameConfig, 'test-session')
      expect(Logger).toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })

  describe('checkTaskGoals', () => {
    it('should return false if no goals defined', async () => {
      const { searchDeviceAndProperty } = await import('../src/lib/server/deviceUtils.js')
      
      const taskDetail = { goals: [] }
      const devices = []

      const result = checkTaskGoals(taskDetail, devices)
      
      expect(result).toBe(false)
      expect(searchDeviceAndProperty).not.toHaveBeenCalled()
    })

    it('should return false if goals property is undefined', () => {
      const taskDetail = {}
      const devices = []

      const result = checkTaskGoals(taskDetail, devices)
      
      expect(result).toBe(false)
    })

    it('should return true when all goals are met', async () => {
      const { searchDeviceAndProperty } = await import('../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty
        .mockReturnValueOnce(true)  // First goal
        .mockReturnValueOnce(50)    // Second goal

      const taskDetail = {
        goals: [
          {
            device: 'light-1',
            condition: { name: 'power', operator: '==', value: true }
          },
          {
            device: 'thermostat-1',
            condition: { name: 'temperature', operator: '>=', value: 20 }
          }
        ]
      }
      const devices = [
        { deviceId: 'light-1', properties: { power: true } },
        { deviceId: 'thermostat-1', properties: { temperature: 50 } }
      ]

      const result = checkTaskGoals(taskDetail, devices)
      
      expect(result).toBe(true)
      expect(searchDeviceAndProperty).toHaveBeenCalledTimes(2)
    })

    it('should return false when any goal is not met', async () => {
      const { searchDeviceAndProperty } = await import('../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty
        .mockReturnValueOnce(true)   // First goal met
        .mockReturnValueOnce(15)     // Second goal not met

      const taskDetail = {
        goals: [
          {
            device: 'light-1',
            condition: { name: 'power', operator: '==', value: true }
          },
          {
            device: 'thermostat-1',
            condition: { name: 'temperature', operator: '>=', value: 20 }
          }
        ]
      }
      const devices = []

      const result = checkTaskGoals(taskDetail, devices)
      
      expect(result).toBe(false)
    })

    it('should handle all comparison operators correctly', async () => {
      const { searchDeviceAndProperty } = await import('../src/lib/server/deviceUtils.js')
      
      const testCases = [
        { operator: '==', deviceValue: 5, goalValue: 5, expected: true },
        { operator: '==', deviceValue: 5, goalValue: 3, expected: false },
        { operator: '!=', deviceValue: 5, goalValue: 3, expected: true },
        { operator: '!=', deviceValue: 5, goalValue: 5, expected: false },
        { operator: '<', deviceValue: 3, goalValue: 5, expected: true },
        { operator: '<', deviceValue: 5, goalValue: 3, expected: false },
        { operator: '>', deviceValue: 5, goalValue: 3, expected: true },
        { operator: '>', deviceValue: 3, goalValue: 5, expected: false },
        { operator: '<=', deviceValue: 3, goalValue: 5, expected: true },
        { operator: '<=', deviceValue: 5, goalValue: 5, expected: true },
        { operator: '<=', deviceValue: 5, goalValue: 3, expected: false },
        { operator: '>=', deviceValue: 5, goalValue: 3, expected: true },
        { operator: '>=', deviceValue: 5, goalValue: 5, expected: true },
        { operator: '>=', deviceValue: 3, goalValue: 5, expected: false }
      ]

      testCases.forEach(testCase => {
        searchDeviceAndProperty.mockReturnValue(testCase.deviceValue)
        
        const taskDetail = {
          goals: [{
            device: 'test-device',
            condition: { name: 'value', operator: testCase.operator, value: testCase.goalValue }
          }]
        }

        const result = checkTaskGoals(taskDetail, [])
        expect(result).toBe(testCase.expected)
        
        vi.clearAllMocks()
      })
    })

    it('should return false for invalid operators', async () => {
      const { searchDeviceAndProperty } = await import('../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(5)

      const taskDetail = {
        goals: [{
          device: 'test-device',
          condition: { name: 'value', operator: 'INVALID', value: 5 }
        }]
      }

      const result = checkTaskGoals(taskDetail, [])
      expect(result).toBe(false)
    })

    it('should return false when device property is not found', async () => {
      const { searchDeviceAndProperty } = await import('../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(null)

      const taskDetail = {
        goals: [{
          device: 'missing-device',
          condition: { name: 'value', operator: '==', value: 5 }
        }]
      }

      const result = checkTaskGoals(taskDetail, [])
      expect(result).toBe(false)
    })
  })

  describe('getInjectibleVariables', () => {
    it('should return empty object if no customData', () => {
      const userData = {}
      const result = getInjectibleVariables(userData)
      expect(result).toEqual({})
    })

    it('should return custom data properties', () => {
      const userData = {
        customData: {
          playerName: 'Alice',
          level: 5,
          score: 1000
        }
      }
      
      const result = getInjectibleVariables(userData)
      
      expect(result).toEqual({
        playerName: 'Alice',
        level: 5,
        score: 1000
      })
    })

    it('should handle empty customData object', () => {
      const userData = { customData: {} }
      const result = getInjectibleVariables(userData)
      expect(result).toEqual({})
    })
  })

  describe('getInGameTime', () => {
    it('should calculate in-game time correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z')
      const gameConfig = {
        environment: {
          time: {
            speed: 60, // 60x speed
            startTime: { hour: 8, minute: 0 }
          }
        }
      }

      // Mock current time to be 1 minute after start (60 seconds)
      const originalDate = global.Date
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(startTime.getTime() + 60000) // +1 minute real time
          } else {
            super(...args)
          }
        }
        static now() {
          return startTime.getTime() + 60000
        }
      }

      const result = getInGameTime(startTime, gameConfig)
      
      // 1 minute real time * 60x speed = 3600 seconds game time = 60 minutes
      // 8:00 + 60 minutes = 9:00
      expect(result).toEqual({ hour: 9, minute: 0 })

      global.Date = originalDate
    })

    it('should handle hour overflow correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z')
      const gameConfig = {
        environment: {
          time: {
            speed: 60,
            startTime: { hour: 23, minute: 30 }
          }
        }
      }

      const originalDate = global.Date
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(startTime.getTime() + 60000) // +1 minute real time
          } else {
            super(...args)
          }
        }
        static now() {
          return startTime.getTime() + 60000
        }
      }

      const result = getInGameTime(startTime, gameConfig)
      
      // 23:30 + 60 minutes = 24:30 -> 0:30 (hour overflow)
      expect(result).toEqual({ hour: 0, minute: 30 })

      global.Date = originalDate
    })

    it('should handle minute overflow correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z')
      const gameConfig = {
        environment: {
          time: {
            speed: 2, // 2x speed for easier calculation
            startTime: { hour: 10, minute: 45 }
          }
        }
      }

      const originalDate = global.Date
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(startTime.getTime() + 30000) // +30 seconds real time
          } else {
            super(...args)
          }
        }
        static now() {
          return startTime.getTime() + 30000
        }
      }

      const result = getInGameTime(startTime, gameConfig)
      
      // 30 seconds real time * 2x speed = 60 seconds = 1 minute game time
      // 10:45 + 1 minute = 10:46
      expect(result).toEqual({ hour: 10, minute: 46 })

      global.Date = originalDate
    })

    it('should handle complex time calculations', () => {
      const startTime = new Date('2023-01-01T10:00:00Z')
      const gameConfig = {
        environment: {
          time: {
            speed: 24, // 24x speed for simpler calculation
            startTime: { hour: 12, minute: 15 }
          }
        }
      }

      const originalDate = global.Date
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(startTime.getTime() + 3600000) // +1 hour real time
          } else {
            super(...args)
          }
        }
        static now() {
          return startTime.getTime() + 3600000
        }
      }

      const result = getInGameTime(startTime, gameConfig)
      
      // 1 hour real time * 24x speed = 24 hours game time
      // 12:15 + 24 hours = 36:15 -> 12:15 (24-hour overflow)
      expect(result).toEqual({ hour: 12, minute: 15 })

      global.Date = originalDate
    })
  })

  describe('getUpdatedTasksWithMetadata', () => {
    it('should return tasks with metadata from game config', async () => {
      const tasks = [
        { taskId: 'task-1', userSessionId: 'test-session' },
        { taskId: 'task-2', userSessionId: 'test-session' }
      ]
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(tasks)
      })

      const gameConfig = {
        tasks: {
          abortable: true,
          tasks: [
            {
              id: 'task-1',
              abortionOptions: ['too_difficult', 'not_interested'],
              abortable: false,
              environment: ['livingroom']
            },
            {
              id: 'task-2',
              abortionOptions: ['skip'],
              // abortable property is missing, so matchedTask.abortable will be undefined
              // Since undefined !== null, it will use undefined, not the global default
              environment: ['kitchen', 'bedroom']
            }
          ]
        }
      }

      const result = await getUpdatedTasksWithMetadata(mockDb, 'test-session', gameConfig)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        taskId: 'task-1',
        userSessionId: 'test-session',
        abortionOptions: ['too_difficult', 'not_interested'],
        abortable: false,
        environment: ['livingroom']
      })
      expect(result[1]).toEqual({
        taskId: 'task-2',
        userSessionId: 'test-session',
        abortionOptions: ['skip'],
        abortable: undefined, // Since undefined !== null, uses the undefined value
        environment: ['kitchen', 'bedroom']
      })
    })

    it('should handle tasks not found in game config', async () => {
      const tasks = [
        { taskId: 'unknown-task', userSessionId: 'test-session' }
      ]
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(tasks)
      })

      const gameConfig = {
        tasks: {
          abortable: false,
          tasks: []
        }
      }

      const result = await getUpdatedTasksWithMetadata(mockDb, 'test-session', gameConfig)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        taskId: 'unknown-task',
        userSessionId: 'test-session'
        // No additional metadata added
      })
    })

    it('should use default values for missing properties', async () => {
      const tasks = [
        { taskId: 'task-1', userSessionId: 'test-session' }
      ]
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(tasks)
      })

      const gameConfig = {
        tasks: {
          abortable: true,
          tasks: [
            {
              id: 'task-1'
              // Missing optional properties
            }
          ]
        }
      }

      const result = await getUpdatedTasksWithMetadata(mockDb, 'test-session', gameConfig)

      expect(result[0]).toEqual({
        taskId: 'task-1',
        userSessionId: 'test-session',
        abortionOptions: [],
        abortable: undefined, // Missing property means undefined, not global default
        environment: []
      })
    })
  })

  describe('updateSubsequentTasks', () => {
    it('should mark incomplete previous tasks as timed out', async () => {
      const incompleteTasks = [
        {
          _id: 'task-obj-1',
          taskId: 'task-1',
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:05:00Z') // 5 minutes duration
        }
      ]
      
      mockTasksCollection.find
        .mockReturnValueOnce({
          toArray: vi.fn().mockResolvedValue(incompleteTasks)
        })
        .mockReturnValueOnce({
          toArray: vi.fn().mockResolvedValue([])
        })

      const mockLogger = { logTaskTimeout: vi.fn() }

      await updateSubsequentTasks(mockDb, 'test-session', 2, {}, mockLogger)

      expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'task-obj-1' },
        {
          $set: {
            isTimedOut: true,
            duration: 300 // 5 minutes in seconds
          }
        }
      )
      expect(mockLogger.logTaskTimeout).toHaveBeenCalledWith('task-1')
    })

    it('should update subsequent task timing correctly', async () => {
      const subsequentTasks = [
        { taskId: 'task-3', userSessionId: 'test-session' },
        { taskId: 'task-4', userSessionId: 'test-session' }
      ]

      mockTasksCollection.find
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) }) // No incomplete previous tasks
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(subsequentTasks) })

      const gameConfig = {
        tasks: {
          timer: 300, // 5 minutes global timer
          tasks: [
            { id: 'task-3', timer: 180 }, // 3 minutes individual timer
            { id: 'task-4' } // Will use global timer
          ]
        }
      }

      const result = await updateSubsequentTasks(mockDb, 'test-session', 2, gameConfig)

      // Should update task-3 with 3-minute duration
      expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
        { userSessionId: 'test-session', taskId: 'task-3' },
        {
          $set: {
            startTime: expect.any(Date),
            endTime: expect.any(Date)
          }
        }
      )

      // Should update task-4 with 5-minute duration (global timer)
      expect(mockTasksCollection.updateOne).toHaveBeenCalledWith(
        { userSessionId: 'test-session', taskId: 'task-4' },
        {
          $set: {
            startTime: expect.any(Date),
            endTime: expect.any(Date)
          }
        }
      )

      expect(result.subsequentTask).toEqual(subsequentTasks[0])
    })

    it('should update device properties for next task', async () => {
      const subsequentTasks = [
        { taskId: 'task-3', userSessionId: 'test-session' }
      ]

      const currentDevice = {
        userSessionId: 'test-session',
        deviceId: 'light-1',
        deviceInteraction: [
          { name: 'power', value: false },
          { name: 'brightness', value: 0 }
        ]
      }

      mockTasksCollection.find
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(subsequentTasks) })
      
      mockDevicesCollection.findOne.mockResolvedValue(currentDevice)

      const gameConfig = {
        tasks: {
          timer: 300,
          tasks: [
            {
              id: 'task-3',
              defaultDeviceProperties: [
                {
                  device: 'light-1',
                  properties: [
                    { name: 'power', value: true },
                    { name: 'brightness', value: 80 }
                  ]
                }
              ]
            }
          ]
        }
      }

      const result = await updateSubsequentTasks(mockDb, 'test-session', 2, gameConfig)

      expect(mockDevicesCollection.updateOne).toHaveBeenCalledWith(
        { userSessionId: 'test-session', deviceId: 'light-1' },
        {
          $set: {
            deviceInteraction: [
              { name: 'power', value: true },
              { name: 'brightness', value: 80 }
            ]
          }
        }
      )

      expect(result.updatedProperties).toEqual([
        { device: 'light-1', interaction: 'power', value: true },
        { device: 'light-1', interaction: 'brightness', value: 80 }
      ])
    })

    it('should return null subsequentTask when no subsequent tasks', async () => {
      mockTasksCollection.find
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) })

      const result = await updateSubsequentTasks(mockDb, 'test-session', 2, {})

      expect(result.subsequentTask).toBeNull()
      expect(result.updatedProperties).toEqual([])
    })
  })
})