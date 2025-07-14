import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../../src/app/api/complete-study/route.ts'
import { createMockDb, createMockRequest, testData } from './apiTestUtils.js'

vi.mock('../../src/lib/mongodb', () => ({
  connectToDatabase: vi.fn()
}))

describe('POST /api/complete-study', () => {
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
    it('should complete a valid session successfully', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockSessionsCollection.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Study completed successfully')
      
      expect(mockSessionsCollection.findOne).toHaveBeenCalledWith({
        sessionId: 'test-session-123'
      })
      
      expect(mockSessionsCollection.updateOne).toHaveBeenCalledWith(
        { sessionId: 'test-session-123' },
        {
          $set: {
            isCompleted: true,
            completionTime: expect.any(Date)
          }
        }
      )
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
  })

  describe('Session Not Found Cases', () => {
    it('should return 404 when session does not exist', async () => {
      const request = createMockRequest('POST', { sessionId: 'non-existent-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue(null)

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error).toBe('User not found or already completed')
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })

    it('should return 404 when session is already completed', async () => {
      const request = createMockRequest('POST', { sessionId: 'completed-session' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.completedSession,
        isCompleted: true
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error).toBe('User not found or already completed')
      expect(mockSessionsCollection.updateOne).not.toHaveBeenCalled()
    })
  })

  describe('Database Update Failures', () => {
    it('should return 404 when update operation matches no documents', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })
      
      mockSessionsCollection.updateOne.mockResolvedValue({
        matchedCount: 0,
        modifiedCount: 0
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error).toBe('Session not found')
    })
  })

  describe('Database Connection Errors', () => {
    it('should return 500 when database connection fails', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      connectToDatabase.mockRejectedValue(new Error('Database connection failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to complete study')
    })

    it('should return 500 when findOne operation fails', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockRejectedValue(new Error('Database query failed'))

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to complete study')
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
      expect(responseData.error).toBe('Failed to complete study')
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
      expect(responseData.error).toBe('Failed to complete study')
    })
  })

  describe('Data Integrity', () => {
    it('should set completionTime to a recent timestamp', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      mockSessionsCollection.findOne.mockResolvedValue({
        ...testData.validSession,
        isCompleted: false
      })

      const beforeCall = new Date()
      await POST(request)
      const afterCall = new Date()

      const updateCall = mockSessionsCollection.updateOne.mock.calls[0]
      const completionTime = updateCall[1].$set.completionTime

      expect(completionTime).toBeInstanceOf(Date)
      expect(completionTime.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(completionTime.getTime()).toBeLessThanOrEqual(afterCall.getTime())
    })

    it('should preserve existing session data when completing', async () => {
      const request = createMockRequest('POST', { sessionId: 'test-session-123' })
      
      const existingSession = {
        ...testData.validSession,
        isCompleted: false,
        customData: { participantId: 'P001', condition: 'A' }
      }
      
      mockSessionsCollection.findOne.mockResolvedValue(existingSession)

      await POST(request)

      const updateCall = mockSessionsCollection.updateOne.mock.calls[0]
      const updateQuery = updateCall[0]
      const updateData = updateCall[1]

      expect(updateQuery).toEqual({ sessionId: 'test-session-123' })
      expect(updateData.$set).toEqual({
        isCompleted: true,
        completionTime: expect.any(Date)
      })
      expect(updateData.$unset).toBeUndefined()
    })
  })
})