import { searchDeviceAndProperty } from "../../deviceUtils.js";
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
 * @returns {Object} - Updates to apply
 */
export async function evaluateRules(db, sessionId, userSession, currentTask, devices, gameConfig, explanationConfig, logger) {
  // Construct context for rule evaluation
  const taskDetail = gameConfig.tasks.tasks.find(task => task.id === currentTask.taskId);
  
  const context = {
    time: getInGameTime(userSession.startTime, gameConfig),
    ...getInjectibleVariables(userSession),
    task: taskDetail?.id || '',
  };

  const updated_properties = [];
  const explanations = [];

  // Evaluate each rule
  for (const rule of gameConfig.rules) {
    const preconditionsMet = checkRulePreconditions(rule, devices, context);
    
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
      const timeValue = context.time?.[precondition.condition.name];
      
      if (timeValue !== undefined) {
        preconditionMet = evaluateCondition(
          timeValue, 
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