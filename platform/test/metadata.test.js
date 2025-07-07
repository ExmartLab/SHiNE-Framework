import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { default: Metadata } = await vi.importActual('../src/lib/server/logger/metadata.js')

describe('Metadata', () => {
  let mockDb
  let mockSessionsCollection
  let mockTasksCollection
  let mockDevicesCollection
  let mockSessionId
  let mockGameConfig
  let metadata

  beforeEach(() => {
    mockSessionId = 'test-session-123'
    
    mockSessionsCollection = {
      findOne: vi.fn()
    }
    
    mockTasksCollection = {
      findOne: vi.fn()
    }
    
    mockDevicesCollection = {
      find: vi.fn(() => ({ toArray: vi.fn(() => []) }))
    }

    mockDb = {
      collection: vi.fn((collectionName) => {
        if (collectionName === 'sessions') return mockSessionsCollection
        if (collectionName === 'tasks') return mockTasksCollection
        if (collectionName === 'devices') return mockDevicesCollection
        return { findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn() }
      })
    }

    mockGameConfig = {
      tasks: {
        tasks: [
          { id: 'task-1', description: 'Test task 1' },
          { id: 'task-2', description: 'Test task 2' }
        ]
      },
      environment: {
        time: {
          speed: 1,
          startTime: { hour: 9, minute: 0 }
        }
      }
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      
      expect(metadata.dbConn).toBe(mockDb)
      expect(metadata.gameConfig).toBe(mockGameConfig)
      expect(metadata.sessionId).toBe(mockSessionId)
      expect(metadata.userData).toBe(null)
    })
  })

  describe('loadUserData', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
    })

    it('should load user data from database', async () => {
      const mockUserData = {
        sessionId: mockSessionId,
        startTime: new Date('2023-01-01T09:00:00Z'),
        customData: { theme: 'dark' }
      }
      
      mockSessionsCollection.findOne.mockResolvedValue(mockUserData)

      await metadata.loadUserData()

      expect(mockSessionsCollection.findOne).toHaveBeenCalledWith({ sessionId: mockSessionId })
      expect(metadata.userData).toBe(mockUserData)
    })

    it('should handle null user data', async () => {
      mockSessionsCollection.findOne.mockResolvedValue(null)

      await metadata.loadUserData()

      expect(mockSessionsCollection.findOne).toHaveBeenCalledWith({ sessionId: mockSessionId })
      expect(metadata.userData).toBe(null)
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockSessionsCollection.findOne.mockRejectedValue(dbError)

      await expect(metadata.loadUserData()).rejects.toThrow('Database connection failed')
    })
  })

  describe('generateMetadata', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      metadata.userData = {
        sessionId: mockSessionId,
        startTime: new Date('2023-01-01T09:00:00Z'),
        customData: { theme: 'dark', notifications: true }
      }
    })

    it('should generate complete metadata object', async () => {
      const mockCurrentTask = {
        taskDetail: { id: 'task-1' },
        currentTask: { taskId: 'task-1' }
      }
      
      const mockUserDevices = [
        { device: 'light-1', interactions: [{ name: 'brightness', value: 80 }] }
      ]

      vi.spyOn(metadata, 'getCurrentUserTask').mockResolvedValue(mockCurrentTask)
      vi.spyOn(metadata, 'getUserDevices').mockResolvedValue(mockUserDevices)
      vi.spyOn(metadata, 'getInGameTime').mockReturnValue({ hour: '09', minute: '30' })
      vi.spyOn(metadata, 'getContextVariables').mockReturnValue([
        { name: 'theme', value: 'dark' },
        { name: 'notifications', value: true }
      ])

      const result = await metadata.generateMetadata()

      expect(result).toEqual({
        user_id: mockSessionId,
        current_task: 'task-1',
        ingame_time: '09:30',
        environment: [
          { name: 'theme', value: 'dark' },
          { name: 'notifications', value: true }
        ],
        devices: mockUserDevices,
        logs: []
      })
    })

    it('should handle null current task', async () => {
      const mockCurrentTask = {
        taskDetail: { id: null },
        currentTask: null
      }
      
      vi.spyOn(metadata, 'getCurrentUserTask').mockResolvedValue(mockCurrentTask)
      vi.spyOn(metadata, 'getUserDevices').mockResolvedValue([])
      vi.spyOn(metadata, 'getInGameTime').mockReturnValue({ hour: '09', minute: '30' })
      vi.spyOn(metadata, 'getContextVariables').mockReturnValue([])

      const result = await metadata.generateMetadata()

      expect(result.current_task).toBe(null)
    })
  })

  describe('getCurrentUserTask', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      metadata.userData = {
        sessionId: mockSessionId,
        startTime: new Date('2023-01-01T09:00:00Z')
      }
    })

    it('should return current active task', async () => {
      const mockCurrentTask = {
        taskId: 'task-1',
        userSessionId: mockSessionId,
        startTime: new Date('2023-01-01T09:00:00Z'),
        endTime: new Date('2023-01-01T10:00:00Z')
      }
      
      mockTasksCollection.findOne.mockResolvedValue(mockCurrentTask)

      const result = await metadata.getCurrentUserTask()

      expect(mockTasksCollection.findOne).toHaveBeenCalledWith({
        userSessionId: mockSessionId,
        startTime: { $lte: expect.any(Date) },
        endTime: { $gte: expect.any(Date) }
      })
      
      expect(result.taskDetail).toEqual({ id: 'task-1', description: 'Test task 1' })
      expect(result.currentTask).toBe(mockCurrentTask)
    })

    it('should handle no current task', async () => {
      mockTasksCollection.findOne.mockResolvedValue(null)

      const result = await metadata.getCurrentUserTask()

      expect(result.taskDetail).toEqual(expect.arrayContaining([]))
      expect(result.taskDetail['id']).toBe(null)
      expect(result.currentTask).toBe(null)
    })

    it('should handle task not found in game config', async () => {
      const mockCurrentTask = {
        taskId: 'non-existent-task',
        userSessionId: mockSessionId
      }
      
      mockTasksCollection.findOne.mockResolvedValue(mockCurrentTask)

      const result = await metadata.getCurrentUserTask()

      expect(result.taskDetail).toBeUndefined()
      expect(result.currentTask).toBe(mockCurrentTask)
    })
  })

  describe('getUserDevices', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
    })

    it('should return formatted user devices', async () => {
      const mockDevices = [
        {
          deviceId: 'light-1',
          deviceInteraction: [
            { name: 'brightness', value: 80 },
            { name: 'color', value: 'warm' }
          ]
        },
        {
          deviceId: 'thermostat-1',
          deviceInteraction: [
            { name: 'temperature', value: 22 }
          ]
        }
      ]
      
      mockDevicesCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.resolve(mockDevices)) })

      const result = await metadata.getUserDevices()

      expect(mockDevicesCollection.find).toHaveBeenCalledWith({ userSessionId: mockSessionId })
      expect(result).toEqual([
        {
          device: 'light-1',
          interactions: [
            { name: 'brightness', value: 80 },
            { name: 'color', value: 'warm' }
          ]
        },
        {
          device: 'thermostat-1',
          interactions: [
            { name: 'temperature', value: 22 }
          ]
        }
      ])
    })

    it('should handle empty devices array', async () => {
      mockDevicesCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.resolve([])) })

      const result = await metadata.getUserDevices()

      expect(result).toEqual([])
    })

    it('should handle devices with no interactions', async () => {
      const mockDevices = [
        {
          deviceId: 'sensor-1',
          deviceInteraction: []
        }
      ]
      
      mockDevicesCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.resolve(mockDevices)) })

      const result = await metadata.getUserDevices()

      expect(result).toEqual([
        {
          device: 'sensor-1',
          interactions: []
        }
      ])
    })
  })

  describe('getContextVariables', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
    })

    it('should return formatted context variables', () => {
      metadata.userData = {
        customData: {
          theme: 'dark',
          notifications: true,
          language: 'en'
        }
      }

      const result = metadata.getContextVariables()

      expect(result).toEqual([
        { name: 'theme', value: 'dark' },
        { name: 'notifications', value: true },
        { name: 'language', value: 'en' }
      ])
    })

    it('should handle missing customData', () => {
      metadata.userData = {}

      const result = metadata.getContextVariables()

      expect(result).toEqual([])
    })

    it('should handle null customData', () => {
      metadata.userData = {
        customData: null
      }

      const result = metadata.getContextVariables()

      expect(result).toEqual([])
    })

    it('should handle empty customData', () => {
      metadata.userData = {
        customData: {}
      }

      const result = metadata.getContextVariables()

      expect(result).toEqual([])
    })
  })

  describe('getInGameTime', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
    })

    it('should calculate in-game time correctly', () => {
      const startTime = new Date('2023-01-01T09:00:00Z')
      const currentTime = new Date('2023-01-01T09:30:00Z')
      const OriginalDate = Date
      
      vi.spyOn(global, 'Date').mockImplementation(function(dateString) {
        if (dateString) return new OriginalDate(dateString)
        return currentTime
      })

      const result = metadata.getInGameTime(startTime)

      expect(result).toEqual({ hour: '09', minute: 30 })
    })

    it('should handle time with speed multiplier', () => {
      mockGameConfig.environment.time.speed = 2
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      
      const startTime = new Date('2023-01-01T09:00:00Z')
      const currentTime = new Date('2023-01-01T09:30:00Z')
      const OriginalDate = Date
      
      vi.spyOn(global, 'Date').mockImplementation(function(dateString) {
        if (dateString) return new OriginalDate(dateString)
        return currentTime
      })

      const result = metadata.getInGameTime(startTime)

      expect(result).toEqual({ hour: 10, minute: '00' })
    })

    it('should handle hour overflow', () => {
      const startTime = new Date('2023-01-01T09:00:00Z')
      const currentTime = new Date('2023-01-01T18:00:00Z')
      const OriginalDate = Date
      
      vi.spyOn(global, 'Date').mockImplementation(function(dateString) {
        if (dateString) return new OriginalDate(dateString)
        return currentTime
      })

      const result = metadata.getInGameTime(startTime)

      expect(result).toEqual({ hour: 18, minute: '00' })
    })

    it('should handle day overflow (24-hour wrap)', () => {
      mockGameConfig.environment.time.startTime = { hour: 23, minute: 0 }
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      
      const startTime = new Date('2023-01-01T09:00:00Z')
      const currentTime = new Date('2023-01-01T11:00:00Z')
      const OriginalDate = Date
      
      vi.spyOn(global, 'Date').mockImplementation(function(dateString) {
        if (dateString) return new OriginalDate(dateString)
        return currentTime
      })

      const result = metadata.getInGameTime(startTime)

      expect(typeof result.hour).toBe('string')
      expect(result.hour).toMatch(/^\d{2}$/)
      expect(result.minute).toBeDefined()
    })

    it('should format single digit hours and minutes with leading zeros', () => {
      mockGameConfig.environment.time.startTime = { hour: 9, minute: 5 }
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      
      const startTime = new Date('2023-01-01T09:00:00Z')
      const currentTime = new Date('2023-01-01T09:00:00Z')
      const OriginalDate = Date
      
      vi.spyOn(global, 'Date').mockImplementation(function(dateString) {
        if (dateString) return new OriginalDate(dateString)
        return currentTime
      })

      const result = metadata.getInGameTime(startTime)

      expect(result).toEqual({ hour: '09', minute: '05' })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
    })

    it('should handle database errors in getCurrentUserTask', async () => {
      metadata.userData = { sessionId: mockSessionId }
      const dbError = new Error('Database query failed')
      mockTasksCollection.findOne.mockRejectedValue(dbError)

      await expect(metadata.getCurrentUserTask()).rejects.toThrow('Database query failed')
    })

    it('should handle database errors in getUserDevices', async () => {
      const dbError = new Error('Device query failed')
      mockDevicesCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.reject(dbError)) })

      await expect(metadata.getUserDevices()).rejects.toThrow('Device query failed')
    })

    it('should handle null userData in generateMetadata', async () => {
      metadata.userData = null

      await expect(metadata.generateMetadata()).rejects.toThrow()
    })

    it('should handle missing game config properties', () => {
      const incompleteGameConfig = {
        environment: {
          time: {
            speed: 1
          }
        }
      }
      
      metadata = new Metadata(mockDb, incompleteGameConfig, mockSessionId)
      
      const startTime = new Date('2023-01-01T09:00:00Z')
      
      expect(() => metadata.getInGameTime(startTime)).toThrow()
    })
  })

  describe('Integration Tests', () => {
    it('should complete full metadata generation workflow', async () => {
      metadata = new Metadata(mockDb, mockGameConfig, mockSessionId)
      
      const mockUserData = {
        sessionId: mockSessionId,
        startTime: new Date('2023-01-01T09:00:00Z'),
        customData: { theme: 'dark' }
      }
      
      const mockCurrentTask = {
        taskId: 'task-1',
        userSessionId: mockSessionId,
        startTime: new Date('2023-01-01T09:00:00Z'),
        endTime: new Date('2023-01-01T10:00:00Z')
      }
      
      const mockDevices = [
        {
          deviceId: 'light-1',
          deviceInteraction: [{ name: 'brightness', value: 80 }]
        }
      ]

      mockSessionsCollection.findOne.mockResolvedValue(mockUserData)
      mockTasksCollection.findOne.mockResolvedValue(mockCurrentTask)
      mockDevicesCollection.find.mockReturnValue({ toArray: vi.fn(() => Promise.resolve(mockDevices)) })

      await metadata.loadUserData()
      const result = await metadata.generateMetadata()

      expect(result.user_id).toBe(mockSessionId)
      expect(result.current_task).toBe('task-1')
      expect(result.devices).toHaveLength(1)
      expect(result.environment).toEqual([{ name: 'theme', value: 'dark' }])
      expect(result.logs).toEqual([])
    })
  })
})