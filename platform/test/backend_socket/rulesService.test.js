import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { evaluateRules } from '../../src/lib/server/services/rulesService.js'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123')
}))

// Mock dependencies
vi.mock('../../src/lib/server/deviceUtils.js', () => ({
  searchDeviceAndProperty: vi.fn()
}))

vi.mock('../../src/lib/server/services/commonServices.js', () => ({
  getInGameTime: vi.fn(() => ({ hour: 10, minute: 30 })),
  getInjectibleVariables: vi.fn(() => ({ playerName: 'TestPlayer' }))
}))

describe('Rules Service', () => {
  let mockDb
  let mockLogger

  beforeEach(() => {
    mockDb = {
      collection: vi.fn(() => ({
        insertOne: vi.fn(),
        updateOne: vi.fn(),
        find: vi.fn(() => ({ toArray: vi.fn(() => []) })),
        findOne: vi.fn()
      }))
    }

    mockLogger = {
      logRuleTrigger: vi.fn()
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('evaluateRules', () => {
    it('should evaluate device preconditions and execute device actions', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(true) // Device condition met

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = [{ deviceId: 'light-1', properties: { power: true } }]
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-1',
            precondition: [
              {
                type: 'Device',
                device: 'light-1',
                condition: { name: 'power', operator: '==', value: true }
              }
            ],
            action: [
              {
                type: 'Device_Interaction',
                device: 'fan-1',
                interaction: { name: 'speed', value: 3 }
              }
            ],
            delay: 2
          }
        ]
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(searchDeviceAndProperty).toHaveBeenCalledWith('light-1', 'power', devices)
      expect(result.updated_properties).toHaveLength(1)
      expect(result.updated_properties[0]).toEqual({
        sessionId: 'test-session',
        deviceId: 'fan-1',
        interaction: 'speed',
        value: 3,
        delay: 2
      })
      expect(mockLogger.logRuleTrigger).toHaveBeenCalledWith('rule-1', [
        {
          device: 'fan-1',
          property: { name: 'speed', value: 3 }
        }
      ])
    })

    it('should evaluate context preconditions', async () => {
      // Arrange
      const { getInjectibleVariables } = await import('../../src/lib/server/services/commonServices.js')
      
      getInjectibleVariables.mockReturnValue({ playerName: 'Alice' })

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = []
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-context',
            precondition: [
              {
                type: 'Context',
                condition: { name: 'playerName', operator: '==', value: 'Alice' }
              }
            ],
            action: [
              {
                type: 'Device_Interaction',
                device: 'welcome-light',
                interaction: { name: 'power', value: true }
              }
            ]
          }
        ]
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(result.updated_properties).toHaveLength(1)
      expect(result.updated_properties[0]).toEqual({
        sessionId: 'test-session',
        deviceId: 'welcome-light',
        interaction: 'power',
        value: true,
        delay: 0
      })
    })

    it('should evaluate time preconditions', async () => {
      // Arrange
      const { getInGameTime } = await import('../../src/lib/server/services/commonServices.js')
      
      getInGameTime.mockReturnValue({ hour: 14, minute: 30 }) // 2:30 PM

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = []
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-time',
            precondition: [
              {
                type: 'Time',
                condition: { name: 'time', operator: '>=', value: '14:00' }
              }
            ],
            action: [
              {
                type: 'Device_Interaction',
                device: 'afternoon-light',
                interaction: { name: 'brightness', value: 80 }
              }
            ]
          }
        ]
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(result.updated_properties).toHaveLength(1)
      expect(result.updated_properties[0].deviceId).toBe('afternoon-light')
      expect(result.updated_properties[0].value).toBe(80)
    })

    it('should handle integrated explanation actions', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(true)

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = [{ deviceId: 'motion-sensor', properties: { detected: true } }]
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-explanation',
            precondition: [
              {
                type: 'Device',
                device: 'motion-sensor',
                condition: { name: 'detected', operator: '==', value: true }
              }
            ],
            action: [
              {
                type: 'Explanation',
                explanation: 'motion_detected'
              }
            ],
            delay: 1
          }
        ]
      }
      
      const explanationConfig = {
        explanation_engine: 'integrated',
        integrated_explanation_engine: {
          motion_detected: 'Motion was detected, so the lights turned on automatically.'
        }
      }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(result.explanations).toHaveLength(1)
      expect(result.explanations[0]).toEqual({
        explanation_id: 'mock-uuid-123',
        explanation: 'Motion was detected, so the lights turned on automatically.',
        created_at: expect.any(Date),
        userSessionId: 'test-session',
        taskId: 'task-1',
        delay: 1
      })
    })

    it('should not execute actions when preconditions are not met', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(false) // Device condition not met

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = [{ deviceId: 'light-1', properties: { power: false } }]
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-fail',
            precondition: [
              {
                type: 'Device',
                device: 'light-1',
                condition: { name: 'power', operator: '==', value: true }
              }
            ],
            action: [
              {
                type: 'Device_Interaction',
                device: 'fan-1',
                interaction: { name: 'power', value: true }
              }
            ]
          }
        ]
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(result.updated_properties).toHaveLength(0)
      expect(result.explanations).toHaveLength(0)
      expect(mockLogger.logRuleTrigger).not.toHaveBeenCalled()
    })

    it('should handle multiple preconditions (all must be met)', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      const { getInjectibleVariables } = await import('../../src/lib/server/services/commonServices.js')
      
      searchDeviceAndProperty
        .mockReturnValueOnce(true) // First device condition met
        .mockReturnValueOnce(false) // Second device condition not met
      
      getInjectibleVariables.mockReturnValue({ playerName: 'Alice' })

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = []
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-multiple',
            precondition: [
              {
                type: 'Device',
                device: 'light-1',
                condition: { name: 'power', operator: '==', value: true }
              },
              {
                type: 'Device',
                device: 'door-1',
                condition: { name: 'open', operator: '==', value: true }
              },
              {
                type: 'Context',
                condition: { name: 'playerName', operator: '==', value: 'Alice' }
              }
            ],
            action: [
              {
                type: 'Device_Interaction',
                device: 'security-system',
                interaction: { name: 'armed', value: false }
              }
            ]
          }
        ]
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert - should not execute action because second device condition failed
      expect(result.updated_properties).toHaveLength(0)
      expect(mockLogger.logRuleTrigger).not.toHaveBeenCalled()
    })

    it('should handle rules with no delay (default to 0)', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(true)

      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = []
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [
          {
            id: 'rule-no-delay',
            precondition: [
              {
                type: 'Device',
                device: 'button-1',
                condition: { name: 'pressed', operator: '==', value: true }
              }
            ],
            action: [
              {
                type: 'Device_Interaction',
                device: 'light-1',
                interaction: { name: 'power', value: true }
              }
            ]
            // No delay property
          }
        ]
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(result.updated_properties[0].delay).toBe(0)
    })

    it('should handle empty rules array', async () => {
      // Arrange
      const sessionId = 'test-session'
      const userSession = { startTime: new Date(), sessionId: 'test-session' }
      const currentTask = { taskId: 'task-1' }
      const devices = []
      
      const gameConfig = {
        tasks: {
          tasks: [{ id: 'task-1', name: 'Test Task' }]
        },
        rules: [] // No rules
      }
      
      const explanationConfig = { explanation_engine: 'external' }

      // Act
      const result = await evaluateRules(
        mockDb,
        sessionId,
        userSession,
        currentTask,
        devices,
        gameConfig,
        explanationConfig,
        mockLogger
      )

      // Assert
      expect(result.updated_properties).toHaveLength(0)
      expect(result.explanations).toHaveLength(0)
    })
  })

  describe('condition evaluation', () => {
    it('should handle all comparison operators correctly', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      
      const testCases = [
        { operator: '==', actual: 5, expected: 5, shouldMatch: true },
        { operator: '==', actual: 5, expected: 3, shouldMatch: false },
        { operator: '!=', actual: 5, expected: 3, shouldMatch: true },
        { operator: '!=', actual: 5, expected: 5, shouldMatch: false },
        { operator: '<', actual: 3, expected: 5, shouldMatch: true },
        { operator: '<', actual: 5, expected: 3, shouldMatch: false },
        { operator: '>', actual: 5, expected: 3, shouldMatch: true },
        { operator: '>', actual: 3, expected: 5, shouldMatch: false },
        { operator: '<=', actual: 3, expected: 5, shouldMatch: true },
        { operator: '<=', actual: 5, expected: 5, shouldMatch: true },
        { operator: '<=', actual: 5, expected: 3, shouldMatch: false },
        { operator: '>=', actual: 5, expected: 3, shouldMatch: true },
        { operator: '>=', actual: 5, expected: 5, shouldMatch: true },
        { operator: '>=', actual: 3, expected: 5, shouldMatch: false }
      ]

      for (const testCase of testCases) {
        // Arrange for this test case
        searchDeviceAndProperty.mockReturnValue(testCase.actual)
        
        const gameConfig = {
          tasks: { tasks: [{ id: 'task-1' }] },
          rules: [{
            id: `rule-${testCase.operator}`,
            precondition: [{
              type: 'Device',
              device: 'test-device',
              condition: { name: 'value', operator: testCase.operator, value: testCase.expected }
            }],
            action: [{
              type: 'Device_Interaction',
              device: 'result-device',
              interaction: { name: 'triggered', value: true }
            }]
          }]
        }

        // Act
        const result = await evaluateRules(
          mockDb,
          'test-session',
          { startTime: new Date() },
          { taskId: 'task-1' },
          [],
          gameConfig,
          { explanation_engine: 'external' },
          mockLogger
        )

        // Assert
        if (testCase.shouldMatch) {
          expect(result.updated_properties).toHaveLength(1)
        } else {
          expect(result.updated_properties).toHaveLength(0)
        }
        
        // Clear mock for next iteration
        vi.clearAllMocks()
      }
    })

    it('should handle invalid operators gracefully', async () => {
      // Arrange
      const { searchDeviceAndProperty } = await import('../../src/lib/server/deviceUtils.js')
      
      searchDeviceAndProperty.mockReturnValue(5)

      const gameConfig = {
        tasks: { tasks: [{ id: 'task-1' }] },
        rules: [{
          id: 'rule-invalid',
          precondition: [{
            type: 'Device',
            device: 'test-device',
            condition: { name: 'value', operator: 'INVALID', value: 5 }
          }],
          action: [{
            type: 'Device_Interaction',
            device: 'result-device',
            interaction: { name: 'triggered', value: true }
          }]
        }]
      }

      // Act
      const result = await evaluateRules(
        mockDb,
        'test-session',
        { startTime: new Date() },
        { taskId: 'task-1' },
        [],
        gameConfig,
        { explanation_engine: 'external' },
        mockLogger
      )

      // Assert
      expect(result.updated_properties).toHaveLength(0)
    })
  })

  describe('time condition evaluation', () => {
    it('should handle time comparisons correctly', async () => {
      // Arrange
      const { getInGameTime } = await import('../../src/lib/server/services/commonServices.js')
      
      const testCases = [
        { currentTime: { hour: 10, minute: 30 }, expected: '10:30', operator: '==', shouldMatch: true },
        { currentTime: { hour: 10, minute: 30 }, expected: '10:31', operator: '==', shouldMatch: false },
        { currentTime: { hour: 10, minute: 30 }, expected: '09:30', operator: '>', shouldMatch: true },
        { currentTime: { hour: 10, minute: 30 }, expected: '11:30', operator: '<', shouldMatch: true },
        { currentTime: { hour: 10, minute: 30 }, expected: '10:30', operator: '>=', shouldMatch: true },
        { currentTime: { hour: 10, minute: 30 }, expected: '10:29', operator: '>=', shouldMatch: true },
        { currentTime: { hour: 10, minute: 30 }, expected: '10:30', operator: '<=', shouldMatch: true },
        { currentTime: { hour: 10, minute: 30 }, expected: '10:31', operator: '<=', shouldMatch: true }
      ]

      for (const testCase of testCases) {
        // Arrange for this test case
        getInGameTime.mockReturnValue(testCase.currentTime)
        
        const gameConfig = {
          tasks: { tasks: [{ id: 'task-1' }] },
          rules: [{
            id: `rule-time-${testCase.operator}`,
            precondition: [{
              type: 'Time',
              condition: { name: 'time', operator: testCase.operator, value: testCase.expected }
            }],
            action: [{
              type: 'Device_Interaction',
              device: 'time-device',
              interaction: { name: 'triggered', value: true }
            }]
          }]
        }

        // Act
        const result = await evaluateRules(
          mockDb,
          'test-session',
          { startTime: new Date() },
          { taskId: 'task-1' },
          [],
          gameConfig,
          { explanation_engine: 'external' },
          mockLogger
        )

        // Assert
        if (testCase.shouldMatch) {
          expect(result.updated_properties).toHaveLength(1)
        } else {
          expect(result.updated_properties).toHaveLength(0)
        }
        
        // Clear mock for next iteration
        vi.clearAllMocks()
      }
    })

    it('should handle invalid time formats gracefully', async () => {
      // Arrange
      const { getInGameTime } = await import('../../src/lib/server/services/commonServices.js')
      
      getInGameTime.mockReturnValue({ hour: 10, minute: 30 })

      const invalidTimeFormats = [
        'invalid',
        '25:30', // Invalid hour
        '10:60', // Invalid minute
        '10', // Missing minute
        '10:30:45', // Too many parts
        '10:-5', // Negative minute
        'abc:def' // Non-numeric
      ]

      for (const invalidTime of invalidTimeFormats) {
        const gameConfig = {
          tasks: { tasks: [{ id: 'task-1' }] },
          rules: [{
            id: 'rule-invalid-time',
            precondition: [{
              type: 'Time',
              condition: { name: 'time', operator: '==', value: invalidTime }
            }],
            action: [{
              type: 'Device_Interaction',
              device: 'time-device',
              interaction: { name: 'triggered', value: true }
            }]
          }]
        }

        // Act
        const result = await evaluateRules(
          mockDb,
          'test-session',
          { startTime: new Date() },
          { taskId: 'task-1' },
          [],
          gameConfig,
          { explanation_engine: 'external' },
          mockLogger
        )

        // Assert
        expect(result.updated_properties).toHaveLength(0)
        
        // Clear mock for next iteration
        vi.clearAllMocks()
      }
    })
  })
})