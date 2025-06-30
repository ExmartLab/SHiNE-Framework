// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db'
process.env.MONGODB_DB = 'test-db'

// Mock MongoDB
vi.mock('../src/lib/mongodb.js', () => ({
  connectToDatabase: vi.fn(() => Promise.resolve({
    db: {
      collection: vi.fn(() => ({
        findOne: vi.fn(),
        insertOne: vi.fn(),
        updateOne: vi.fn(),
        deleteOne: vi.fn(),
        find: vi.fn(() => ({ toArray: vi.fn() }))
      }))
    }
  }))
}))

// Mock logger
vi.mock('../src/lib/server/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))