import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../../src/app/api/verify-session/route.ts'
import { createMockDb, createMockRequest, testData } from './apiTestUtils.js'

vi.mock('../../src/lib/mongodb', () => ({
  connectToDatabase: vi.fn()
}))

describe('POST /api/verify-session', () => {
  let mockDb, mockSessionsCollection
  let connectToDatabase

  beforeEach(async () => {
    const mockDbResult = createMockDb()
    mockDb = mockDbResult.mockDb
    mockSessionsCollection = mockDbResult.mockSessionsCollection
    
    connectToDatabase = vi.mocked(await import('../../src/lib/mongodb')).connectToDatabase
    connectToDatabase.mockResolvedValue({ db: mockDb })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Success Cases', () => {
    it('should verify valid active session successfully', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      const activeSession = {
        ...testData.validSession,
        isCompleted: false,
        currentScenario: 'scenario-1',
        experimentGroup: 'group-A'
      }
      
      mockSessionsCollection.findOne.mockResolvedValue(activeSession)
      mockSessionsCollection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.isValid).toBe(true)
      expect(responseData.currentScenario).toBe('scenario-1')
      expect(responseData.experimentGroup).toBe('group-A')
      
      expect(mockSessionsCollection.findOne).toHaveBeenCalledWith({
        sessionId: 'test-session-123'
      })
      
      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { sessionId: 'test-session-123' },
        { $set: { lastActivity: expect.any(Date) } }
      )
    })

    it('should update lastActivity timestamp when verifying session', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })

      const beforeCall = new Date()
      await POST(request)
      const afterCall = new Date()

      const updateCall = mockSessionsCollection.updateOne.mock.calls[0]
      const lastActivity = updateCall[1].$set.lastActivity

      expect(lastActivity).toBeInstanceOf(Date)
      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(lastActivity.getTime()).toBeLessThanOrEqual(afterCall.getTime())
    })

    it('should handle session with missing optional fields', async () => {
      const request = createMockRequest('POST', { sessionId: 'minimal-session' })
      
      const minimalSession = {
        sessionId: 'minimal-session',
        isCompleted: false,
        startTime: new Date()
      }
      
      mockSessionsCollection.findOne.mockResolvedValue(minimalSession)

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.isValid).toBe(true)
      expect(responseData.currentScenario).toBeUndefined()
      expect(responseData.experimentGroup).toBeUndefined()
    })
  })

  describe('Validation Errors', () => {
    it('should return 400 when sessionId is missing', async () => {
      const request = createMockRequest('POST', {})

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
      expect(mockSessionsCollection.findOne).not.toHaveBeenCalled()
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })

    it('should return 400 when sessionId is null', async () => {
      const request = createMockRequest('POST', { sessionId: null })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
    })

    it('should return 400 when sessionId is empty string', async () => {
      const request = createMockRequest('POST', { sessionId: '' })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
    })

    it('should return 400 when sessionId is undefined', async () => {
      const request = createMockRequest('POST', { sessionId: undefined })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Session ID is required')
    })
  })

  describe('Session Not Found Cases', () => {
    it('should return 404 when session does not exist', async () => {
      const request = createMockRequest('POST', { sessionId: 'non-existent-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue(null)

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.isValid).toBe(false)
      expect(responseData.error).toBe('Session not found')
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })
  })

  describe('Completed Session Cases', () => {
    it('should return 400 when session is already completed', async () => {
      const request = createMockRequest('POST', { sessionId: 'completed-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.completedSession,
        isCompleted: true
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.isValid).toBe(false)
      expect(responseData.error).toBe('Session is completed')
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })

    it('should not update lastActivity for completed sessions', async () => {
      const request = createMockRequest('POST', { sessionId: 'completed-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        sessionId: 'completed-session',
        isCompleted: true,
        completionTime: new Date()
      })

      await POST(request)

      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })
  })

  describe('Database Errors', () => {
    it('should return 500 when database connection fails', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      connectToDatabase.mockRejectedValue(new Error('Database connection failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.isValid).toBe(false)
      expect(responseData.error).toBe('Failed to verify session')
    })

    it('should return 500 when findOne operation fails', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockRejectedValue(new Error('Database query failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.isValid).toBe(false)
      expect(responseData.error).toBe('Failed to verify session')
    })

    it('should return 500 when updateOne operation fails', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockSessionsCollection.updateOne.mockRejectedValue(new Error('Update failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.isValid).toBe(false)
      expect(responseData.error).toBe('Failed to verify session')
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
      expect(responseData.isValid).toBe(false)
      expect(responseData.error).toBe('Failed to verify session')
    })
  })

  describe('Response Structure', () => {
    it('should always include isValid field in response', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue(null)

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData).toHaveProperty('isValid')
      expect(typeof responseData.isValid).toBe('boolean')
    })

    it('should include session metadata for valid sessions', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      const sessionWithMetadata = {
        sessionId: 'test-session-123',
        isCompleted: false,
        currentScenario: 'test-scenario',
        experimentGroup: 'control-group',
        customData: { participantId: 'P001' }
      }
      
      mockSessionsCollection.findOne.mockResolvedValue(sessionWithMetadata)

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.isValid).toBe(true)
      expect(responseData.currentScenario).toBe('test-scenario')
      expect(responseData.experimentGroup).toBe('control-group')
      expect(responseData).not.toHaveProperty('customData')
      expect(responseData).not.toHaveProperty('sessionId')
    })

    it('should include error field for failed validations', async () => {
      const request = createMockRequest('POST', {})

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.isValid).toBe(false)
      expect(responseData).toHaveProperty('error')
      expect(typeof responseData.error).toBe('string')
    })
  })

  describe('Activity Tracking', () => {
    it('should only update lastActivity for active sessions', async () => {
      const request = createMockRequest('POST', { sessionId: 'active-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        sessionId: 'active-session',
        isCompleted: false,
        startTime: new Date()
      })

      await POST(request)

      expect(mockSessionsCollection.updateOne).toHaveBeenCalledTimes(1)
      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { sessionId: 'active-session' },
        { $set: { lastActivity: expect.any(Date) } }
      )
    })

    it('should handle updateOne operation gracefully even if no changes occur', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockSessionsCollection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 0
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.isValid).toBe(true)
    })
  })
})