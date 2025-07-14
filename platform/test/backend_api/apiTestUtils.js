import { vi } from 'vitest'

/**
 * Mock MongoDB database for API testing
 * Provides standardized mocked collections with common methods
 */
export function createMockDb() {
  const mockSessionsCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1, modifiedCount: 1 })),
    insertOne: vi.fn(() => Promise.resolve({ insertedId: 'mock-id' })),
    insertMany: vi.fn(() => Promise.resolve({ insertedIds: ['id1', 'id2'] })),
    find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) }))
  }

  const mockTasksCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1, modifiedCount: 1 })),
    insertOne: vi.fn(() => Promise.resolve({ insertedId: 'mock-id' })),
    insertMany: vi.fn(() => Promise.resolve({ insertedIds: ['id1', 'id2'] })),
    find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) }))
  }

  const mockDevicesCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1, modifiedCount: 1 })),
    insertOne: vi.fn(() => Promise.resolve({ insertedId: 'mock-id' })),
    insertMany: vi.fn(() => Promise.resolve({ insertedIds: ['id1', 'id2'] })),
    find: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) }))
  }

  const mockDb = {
    collection: vi.fn((name) => {
      switch (name) {
        case 'sessions':
          return mockSessionsCollection
        case 'tasks':
          return mockTasksCollection
        case 'devices':
          return mockDevicesCollection
        default:
          return mockSessionsCollection
      }
    })
  }

  return {
    mockDb,
    mockSessionsCollection,
    mockTasksCollection,
    mockDevicesCollection
  }
}

/**
 * Create mock Request object for Next.js API testing
 */
export function createMockRequest(method = 'POST', data = {}, searchParams = {}) {
  const url = new URL('http://localhost:3000/api/test')
  
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return {
    method,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(data)),
    text: vi.fn(() => Promise.resolve(JSON.stringify(data)))
  }
}

/**
 * Sample test data for API testing
 */
export const testData = {
  validSession: {
    sessionId: 'test-session-123',
    startTime: new Date('2024-01-01T10:00:00Z'),
    lastActivity: new Date('2024-01-01T10:30:00Z'),
    isCompleted: false,
    customData: { participantId: 'P001' }
  },

  completedSession: {
    sessionId: 'completed-session-456',
    startTime: new Date('2024-01-01T09:00:00Z'),
    isCompleted: true,
    completionTime: new Date('2024-01-01T10:00:00Z')
  },

  sampleTasks: [
    {
      userSessionId: 'test-session-123',
      taskId: 'task-1',
      task_order: 0,
      taskDescription: 'Turn on the lights',
      isCompleted: false,
      isAborted: false,
      isTimedOut: false,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z')
    }
  ],

  sampleDevices: [
    {
      userSessionId: 'test-session-123',
      deviceId: 'light-1',
      deviceInteraction: [
        {
          name: 'power',
          type: 'boolean',
          value: false
        }
      ]
    }
  ],

  createSessionPayload: {
    sessionId: 'new-session-789',
    custom_data: { participantId: 'P002' },
    userAgent: 'Mozilla/5.0 (Test Browser)',
    screenSize: { width: 1920, height: 1080 }
  }
}