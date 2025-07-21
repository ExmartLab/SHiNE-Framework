import { searchDeviceAndProperty, injectStatelessAction } from "../deviceUtils.js";
import { getInGameTime, getInjectibleVariables } from "./commonServices.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * Evaluate game rules based on current state
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @param {Object} userSession - User session data
 * @param {Object} currentTask - Current task data
 * @param {Array} devices - Device states
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationConfig - Explanation configuration
 * @param {Object} logger - Logger instance
 * @param {Object} triggeringAction - Optional triggering action { device, interaction, value }
 * @returns {Object} - Updates to apply
 */
export async function evaluateRules(db, sessionId, userSession, currentTask, devices, gameConfig, explanationConfig, logger, triggeringAction = null) {
  // Construct context for rule evaluation
  const taskDetail = gameConfig.tasks.tasks.find(task => task.id === currentTask.taskId);
  
  const context = {
    time: getInGameTime(userSession.startTime, gameConfig),
    ...getInjectibleVariables(userSession),
    task: taskDetail?.id || '',
  };

  // Inject stateless action if provided
  let devicesForRuleEvaluation = devices;
  if (triggeringAction && triggeringAction.device && triggeringAction.interaction) {
    devicesForRuleEvaluation = injectStatelessAction(devices, triggeringAction);
  }

  const updated_properties = [];
  const explanations = [];

  // Evaluate each rule
  for (const rule of gameConfig.rules) {
    const preconditionsMet = checkRulePreconditions(rule, devicesForRuleEvaluation, context);
    
    if (preconditionsMet) {
      const actionRules = [];
      
      // Apply rule actions
      for (const action of rule.action) {
        if (action.type === "Device_Interaction") {
          updated_properties.push({
            sessionId: sessionId,
            deviceId: action.device,
            interaction: action.interaction.name,
            value: action.interaction.value,
            delay: rule.delay ?? 0
          });
          
          // Track for logging
          actionRules.push({
            'device': action.device,
            'property': {
              'name': action.interaction.name,
              'value': action.interaction.value,
            }
          });
        } else if (action.type === "Explanation" && explanationConfig.explanation_engine === "integrated") {
          explanations.push({
            'explanation_id': uuidv4(),
            'explanation': explanationConfig.integrated_explanation_engine[action.explanation],
            'created_at': new Date(),
            'userSessionId': sessionId,
            'taskId': currentTask.taskId,
            'delay': rule.delay ?? 0
          });
        }
      }
      
      // Log rule trigger with action details
      if (logger && actionRules.length > 0) {
        await logger.logRuleTrigger(rule.id, actionRules);
      }
    }
  }

  return { updated_properties, explanations };
}

/**
 * Check if rule preconditions are met
 * @param {Object} rule - Rule to check
 * @param {Array} devices - Device states
 * @param {Object} context - Context variables
 * @returns {boolean} - Whether preconditions are met
 */
function checkRulePreconditions(rule, devices, context) {
  for (const precondition of rule.precondition) {
    let preconditionMet = false;
    
    if (precondition.type === "Device") {
      const deviceValue = searchDeviceAndProperty(
        precondition.device, 
        precondition.condition.name, 
        devices
      );
      
      if (deviceValue !== null) {
        preconditionMet = evaluateCondition(
          deviceValue, 
          precondition.condition.operator, 
          precondition.condition.value
        );
      }
    } else if (precondition.type === "Context") {
      const contextValue = context[precondition.condition.name];
      
      if (contextValue !== null && contextValue !== undefined) {
        preconditionMet = evaluateCondition(
          contextValue, 
          precondition.condition.operator, 
          precondition.condition.value
        );
      }
    } else if (precondition.type === "Time") {
      const currentTime = context.time;
      if (currentTime && typeof precondition.condition.value === 'string') {
        preconditionMet = evaluateTimeCondition(
          currentTime,
          precondition.condition.operator,
          precondition.condition.value
        );
      }
    }
    
    if (!preconditionMet) {
      return false;
    }
  }
  
  return true;
}

/**
 * Evaluate a condition based on operator
 * @param {*} actual - Actual value
 * @param {string} operator - Comparison operator
 * @param {*} expected - Expected value
 * @returns {boolean} - Result of comparison
 */
function evaluateCondition(actual, operator, expected) {
  switch (operator) {
    case '==':
      return actual == expected;
    case '!=':
      return actual != expected;
    case '<':
      return actual < expected;
    case '>':
      return actual > expected;
    case '<=':
      return actual <= expected;
    case '>=':
      return actual >= expected;
    default:
      return false;
  }
}

/**
 * Evaluate time condition with HH:MM format
 * @param {Object} currentTime - Current time object with hour and minute
 * @param {string} operator - Comparison operator
 * @param {string} expectedTime - Expected time in HH:MM format
 * @returns {boolean} - Result of time comparison
 */
function evaluateTimeCondition(currentTime, operator, expectedTime) {
  // Parse expected time (HH:MM format)
  const timeParts = expectedTime.split(':');
  if (timeParts.length !== 2) {
    return false;
  }
  
  const expectedHour = parseInt(timeParts[0], 10);
  const expectedMinute = parseInt(timeParts[1], 10);
  
  // Validate parsed values
  if (isNaN(expectedHour) || isNaN(expectedMinute) || 
      expectedHour < 0 || expectedHour > 23 || 
      expectedMinute < 0 || expectedMinute > 59) {
    return false;
  }
  
  // Convert both times to minutes for easy comparison
  const currentMinutes = currentTime.hour * 60 + currentTime.minute;
  const expectedMinutes = expectedHour * 60 + expectedMinute;
  
  // Evaluate condition
  switch (operator) {
    case '==':
      return currentMinutes === expectedMinutes;
    case '!=':
      return currentMinutes !== expectedMinutes;
    case '<':
      return currentMinutes < expectedMinutes;
    case '>':
      return currentMinutes > expectedMinutes;
    case '<=':
      return currentMinutes <= expectedMinutes;
    case '>=':
      return currentMinutes >= expectedMinutes;
    default:
      return false;
  }
}

