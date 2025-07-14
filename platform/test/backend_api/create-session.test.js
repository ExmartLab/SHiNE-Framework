import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../../src/app/api/create-session/route.ts'
import { createMockDb, createMockRequest, testData } from './apiTestUtils.js'

vi.mock('../../src/lib/mongodb', () => ({
  connectToDatabase: vi.fn()
}))

vi.mock('../../src/game.json', () => ({
  default: {
    tasks: {
      timer: 300,
      ordered: true,
      abortable: true,
      tasks: [
        {
          id: 'task-1',
          description: 'Turn on the lights',
          timer: 180,
          abortable: true,
          abortionOptions: ['Too difficult', 'Not interested'],
          environment: [],
          defaultDeviceProperties: [
            {
              device: 'light-1',
              properties: [
                { name: 'power', value: false }
              ]
            }
          ]
        },
        {
          id: 'task-2',
          description: 'Adjust temperature',
          defaultDeviceProperties: []
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
                    currentState: { value: true }
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

describe('POST /api/create-session', () => {
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
    it('should create a new session successfully', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockDevicesCollection.findOne.mockResolvedValue({
        userSessionId: 'new-session-789',
        deviceId: 'light-1',
        deviceInteraction: [{ name: 'power', type: 'boolean', value: true }]
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Session created successfully')
      expect(responseData.sessionId).toBe('new-session-789')
      
      expect(mockSessionsCollection.insertOne).toHaveBeenCalledWith({
        sessionId: 'new-session-789',
        startTime: expect.any(Date),
        lastActivity: expect.any(Date),
        userAgent: 'Mozilla/5.0 (Test Browser)',
        screenSize: { width: 1920, height: 1080 },
        isCompleted: false,
        completionTime: null,
        customData: { participantId: 'P002' },
        explanation_cache: null,
        socketId: null
      })
    })

    it('should create tasks with correct timing', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockDevicesCollection.findOne.mockResolvedValue({
        userSessionId: 'new-session-789',
        deviceId: 'light-1',
        deviceInteraction: [{ name: 'power', type: 'boolean', value: true }]
      })

      await POST(request)

      expect(mockTasksCollection.insertMany).toHaveBeenCalled()
      const insertedTasks = mockTasksCollection.insertMany.mock.calls[0][0]
      
      expect(insertedTasks).toHaveLength(2)
      expect(insertedTasks[0]).toMatchObject({
        userSessionId: 'new-session-789',
        taskId: 'task-1',
        task_order: 0,
        taskDescription: 'Turn on the lights',
        isCompleted: false,
        isAborted: false,
        isTimedOut: false,
        interactionTimes: 0
      })
      
      expect(insertedTasks[1]).toMatchObject({
        userSessionId: 'new-session-789',
        taskId: 'task-2',
        task_order: 1,
        taskDescription: 'Adjust temperature'
      })
      
      const firstTaskDuration = insertedTasks[0].endTime - insertedTasks[0].startTime
      expect(firstTaskDuration).toBe(180 * 1000)
      
      const secondTaskDuration = insertedTasks[1].endTime - insertedTasks[1].startTime
      expect(secondTaskDuration).toBe(300 * 1000)
    })

    it('should create device records for all game devices', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockDevicesCollection.findOne.mockResolvedValue({
        userSessionId: 'new-session-789',
        deviceId: 'light-1',
        deviceInteraction: [{ name: 'power', type: 'boolean', value: true }]
      })

      await POST(request)

      expect(mockDevicesCollection.insertMany).toHaveBeenCalled()
      const insertedDevices = mockDevicesCollection.insertMany.mock.calls[0][0]
      
      expect(insertedDevices).toHaveLength(1)
      expect(insertedDevices[0]).toMatchObject({
        userSessionId: 'new-session-789',
        deviceId: 'light-1',
        deviceInteraction: [
          {
            name: 'power',
            type: 'boolean',
            value: true
          }
        ]
      })
    })
  })

  describe('Validation Errors', () => {
    it('should return 400 when sessionId is missing', async () => {
      const request = createMockRequest('POST', { custom_data: { participantId: 'P001' } })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Missing required fields')
      expect(mockSessionsCollection.insertOne).not.toHaveBeenCalled()
    })

    it('should return 400 when custom_data is missing', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session' })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Missing required fields')
    })

    it('should return 400 when both sessionId and custom_data are missing', async () => {
      const request = createMockRequest('POST', {})

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Missing required fields')
    })
  })

  describe('Duplicate Session Handling', () => {
    it('should return 409 when session already exists and is active', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue({
        sessionId: 'new-session-789',
        isCompleted: false,
        currentScenario: 'scenario-1'
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(409)
      expect(responseData.error).toBe('Participant already has an active session')
      expect(responseData.existingSessionId).toBe('new-session-789')
      expect(responseData.currentScenario).toBe('scenario-1')
      expect(mockSessionsCollection.insertOne).not.toHaveBeenCalled()
    })

    it('should allow creating session when previous session is completed', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockDevicesCollection.findOne.mockResolvedValue({
        userSessionId: 'new-session-789',
        deviceId: 'light-1',
        deviceInteraction: [{ name: 'power', type: 'boolean', value: true }]
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(mockSessionsCollection.insertOne).toHaveBeenCalled()
    })
  })

  describe('Database Errors', () => {
    it('should return 500 when database connection fails', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      connectToDatabase.mockRejectedValue(new Error('Database connection failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to create session')
    })

    it('should return 500 when session insertion fails', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockSessionsCollection.insertOne.mockRejectedValue(new Error('Insert failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to create session')
    })

    it('should return 500 when tasks insertion fails', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockTasksCollection.insertMany.mockRejectedValue(new Error('Tasks insert failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to create session')
    })
  })

  describe('Data Integrity', () => {
    it('should set timestamps correctly during session creation', async () => {
      const request = createMockRequest('POST', testData.createSessionPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockDevicesCollection.findOne.mockResolvedValue({
        userSessionId: 'new-session-789',
        deviceId: 'light-1',
        deviceInteraction: [{ name: 'power', type: 'boolean', value: true }]
      })

      const beforeCall = new Date()
      await POST(request)
      const afterCall = new Date()

      const sessionData = mockSessionsCollection.insertOne.mock.calls[0][0]
      
      expect(sessionData.startTime).toBeInstanceOf(Date)
      expect(sessionData.lastActivity).toBeInstanceOf(Date)
      expect(sessionData.startTime.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(sessionData.startTime.getTime()).toBeLessThanOrEqual(afterCall.getTime())
    })

    it('should handle missing optional fields gracefully', async () => {
      const minimalPayload = {
        sessionId: 'minimal-session',
        custom_data: { participantId: 'P003' }
      }
      const request = createMockRequest('POST', minimalPayload)
      
      mockSessionsCollection.findOne.mockResolvedValue(null)
      mockDevicesCollection.findOne.mockResolvedValue({
        userSessionId: 'minimal-session',
        deviceId: 'light-1',
        deviceInteraction: [{ name: 'power', type: 'boolean', value: true }]
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      
      const sessionData = mockSessionsCollection.insertOne.mock.calls[0][0]
      expect(sessionData.userAgent).toBe(null)
      expect(sessionData.screenSize).toBe(null)
      expect(sessionData.customData).toEqual({ participantId: 'P003' })
    })
  })

  describe('JSON Parsing Errors', () => {
    it('should return 500 when request JSON parsing fails', async () => {
      const request = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      }

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to create session')
    })
  })
})