import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from '../../src/app/api/game-data/route.ts'
import { createMockDb, createMockRequest, testData } from './apiTestUtils.js'

vi.mock('../../src/lib/mongodb', () => ({
  connectToDatabase: vi.fn()
}))

vi.mock('../../src/game.json', () => ({
  default: {
    environment: {
      time: {
        startTime: { hour: 22, minute: 0 },
        speed: 10
      }
    },
    tasks: {
      timer: 300,
      abortable: true,
      tasks: [
        {
          id: 'task-1',
          description: 'Turn on the lights',
          abortable: true,
          abortionOptions: ['Too difficult', 'Not interested'],
          environment: ['dark_room']
        }
      ]
    },
    rooms: [
      {
        name: 'Living Room',
        walls: [
          {
            devices: [
              {
                id: 'light-1',
                interactions: [
                  {
                    name: 'power',
                    InteractionType: 'boolean',
                    currentState: { value: false }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}))

vi.mock('../../src/explanation.json', () => ({
  default: {
    explanation_trigger: 'push'
  }
}))

describe('GET /api/game-data', () => {
  let mockDb, mockSessionsCollection, mockTasksCollection, mockDevicesCollection
  let connectToDatabase

  beforeEach(async () => {
    const mockDbResult = createMockDb()
    mockDb = mockDbResult.mockDb
    mockSessionsCollection = mockDbResult.mockSessionsCollection
    mockTasksCollection = mockDbResult.mockTasksCollection
    mockDevicesCollection = mockDbResult.mockDevicesCollection
    
    connectToDatabase = vi.mocked(await import('../../src/lib/mongodb')).connectToDatabase
    connectToDatabase.mockResolvedValue({ db: mockDb })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Success Cases', () => {
    it('should retrieve game data successfully for valid session', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userSessionId: 'test-session-123',
            deviceId: 'light-1',
            deviceInteraction: [
              { name: 'power', type: 'boolean', value: true }
            ]
          }
        ])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userSessionId: 'test-session-123',
            taskId: 'task-1',
            task_order: 0,
            taskDescription: 'Turn on the lights'
          }
        ])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Game data retrieved successfully')
      expect(responseData.gameConfig).toBeDefined()
      expect(responseData.tasks).toBeDefined()
      expect(responseData.tasks).toHaveLength(1)
    })

    it('should update device states in game configuration', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userSessionId: 'test-session-123',
            deviceId: 'light-1',
            deviceInteraction: [
              { name: 'power', type: 'boolean', value: true }
            ]
          }
        ])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userSessionId: 'test-session-123',
            taskId: 'task-1'
          }
        ])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      const lightDevice = responseData.gameConfig.rooms[0].walls[0].devices[0]
      expect(lightDevice.id).toBe('light-1')
      expect(lightDevice.interactions[0].currentState.value).toBe(true)
    })

    it('should enhance tasks with configuration data', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userSessionId: 'test-session-123',
            taskId: 'task-1',
            task_order: 0,
            taskDescription: 'Turn on the lights'
          }
        ])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      const enhancedTask = responseData.tasks[0]
      expect(enhancedTask.abortionOptions).toEqual(['Too difficult', 'Not interested'])
      expect(enhancedTask.abortable).toBe(true)
      expect(enhancedTask.environment).toEqual(['dark_room'])
    })

    it('should include explanation configuration', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(responseData.gameConfig.explanation).toBeDefined()
      expect(responseData.gameConfig.explanation.explanation_trigger).toBe('push')
    })

    it('should set game start time from session data', async () => {
      const sessionStartTime = new Date('2024-01-01T10:00:00Z')
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: sessionStartTime
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(responseData.gameConfig.environment.time.gameStart).toBe(sessionStartTime.getTime())
    })
  })

  describe('Validation Errors', () => {
    it('should return 400 when sessionId is missing', async () => {
      const request = createMockRequest('GET', {}, {})

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
      expect(mockSessionsCollection.findOne).not.toHaveBeenCalled()
    })

    it('should return 400 when sessionId is null', async () => {
      const request = createMockRequest('GET', {}, { sessionId: null })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
    })

    it('should return 400 when sessionId is empty string', async () => {
      const request = createMockRequest('GET', {}, { sessionId: '' })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
    })
  })

  describe('Session Not Found Cases', () => {
    it('should return 404 when session does not exist', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'non-existent-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue(null)

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error).toBe('Session not found or already completed')
      expect(responseData.session_completed).toBeUndefined()
    })

    it('should return 404 when session is completed', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'completed-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.completedSession,
        isCompleted: true
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error).toBe('Session not found or already completed')
      expect(responseData.session_completed).toBe(true)
    })
  })

  describe('Database Errors', () => {
    it('should return 500 when database connection fails', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      connectToDatabase.mockRejectedValue(new Error('Database connection failed'))

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('An error occurred')
    })

    it('should return 500 when session lookup fails', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockRejectedValue(new Error('Database query failed'))

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('An error occurred')
    })

    it('should return 500 when concurrent data fetch fails', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('Devices fetch failed'))
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('An error occurred')
    })
  })

  describe('Data Processing', () => {
    it('should handle empty device list', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.tasks).toEqual([])
    })

    it('should handle tasks with missing configuration gracefully', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userSessionId: 'test-session-123',
            taskId: 'unknown-task',
            task_order: 0
          }
        ])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)

      expect(response.status).toBe(500)
      expect(await response.json()).toMatchObject({
        error: 'An error occurred'
      })
    })

    it('should remove tasks configuration from gameConfig', async () => {
      const request = createMockRequest('GET', {}, { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockDevicesCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockTasksCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      
      mockSessionsCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{
          sessionId: 'test-session-123',
          startTime: new Date('2024-01-01T10:00:00Z')
        }])
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(responseData.gameConfig.tasks).toBe(null)
    })
  })
})