import { updateDeviceInteraction } from "../deviceUtils.js";
import { 
  validateSession, 
  getCurrentTask, 
  createLogger, 
  checkTaskGoals,
  updateSubsequentTasks,
  getUpdatedTasksWithMetadata
} from "../services/commonServices.js";
import { evaluateRules } from "../services/rulesService.js";

/**
 * Handle device interaction socket events
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - Event data
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationConfig - Explanation configuration
 * @param {Object} explanationEngine - Explanation engine instance
 */
export async function handleDeviceInteraction(socket, db, data, gameConfig, explanationConfig, explanationEngine) {
  // Validate session
  const userSession = await validateSession(socket, db, data.sessionId);
  if (!userSession) return;

  // Get current task
  const currentTask = await getCurrentTask(db, data.sessionId);
  if (!currentTask) return;

  // Create logger
  const logger = await createLogger(db, data.sessionId, gameConfig, explanationEngine);

  // Update interaction counter
  await db.collection('tasks').updateOne(
    { userSessionId: data.sessionId, taskId: currentTask.taskId }, 
    { $inc: { interactionTimes: 1 } }
  );
  
  // Log device interaction
  const deviceInteractionLog = await updateDeviceInteraction(db, data, true);
  logger.logDeviceInteraction(deviceInteractionLog);

  // Get task details
  const taskDetail = gameConfig.tasks.tasks.find(task => task.id === currentTask.taskId);
  if (!taskDetail) return;

  // Get all devices
  const devices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();

  // Evaluate rules
  const { updated_properties, explanations } = await evaluateRules(
    db, 
    data.sessionId, 
    userSession, 
    currentTask, 
    devices, 
    gameConfig, 
    explanationConfig,
    logger
  );

  // Process rule-triggered device updates
  for (const prop of updated_properties) {
    const interactionChange = async () => {
      await updateDeviceInteraction(db, {
        sessionId: prop.sessionId,
        device: prop.deviceId,
        interaction: prop.interaction,
        value: prop.value,
      }, false);
      
      socket.emit('update-interaction', prop);
    };

    if (prop.delay === 0) {
      await interactionChange();
    } else {
      setTimeout(interactionChange, prop.delay * 1000);
    }
  }

  // Process explanations
  if (explanations.length > 0) {
    if (explanationConfig.explanation_trigger === 'automatic') {
      let rating = null;
      if(explanationConfig.explanation_rating == 'like') {
          rating = 'like';
      }

      for (const explanation of explanations) {
        const explanationGeneration = async () => {
          await db.collection('explanations').insertOne(explanation);
          socket.emit('explanation', {explanation: explanation.explanation, explanation_id: explanation.explanation_id, rating: rating});
        };

        if (explanation.delay === 0) {
          await explanationGeneration();
        } else {
          setTimeout(explanationGeneration, explanation.delay * 1000);
        }
      }
    } else if (explanationConfig.explanation_trigger === 'on_demand') {
      const latestExplanation = explanations[explanations.length - 1];
      
      const explanationCache = async () => {
        await db.collection('sessions').updateOne(
          { sessionId: data.sessionId }, 
          { $set: { explanation_cache: latestExplanation } }
        );
      };

      if (latestExplanation.delay === 0) {
        await explanationCache();
      } else {
        setTimeout(explanationCache, latestExplanation.delay * 1000);
      }
    }
  }

  // Get updated devices after rules processing
  const updatedDevices = await db.collection('devices').find({ userSessionId: data.sessionId }).toArray();

  // Check if task goals are met
  const goalMet = checkTaskGoals(taskDetail, updatedDevices);

  if (goalMet) {
    // Update task completion
    const taskDurationSec = (new Date() - currentTask.startTime) / 1000;
    
    await logger.logTaskCompleted(currentTask.taskId);

    await db.collection('tasks').updateOne(
      { _id: currentTask._id }, 
      { 
        $set: { 
          endTime: new Date(), 
          completionTime: new Date(), 
          isCompleted: true, 
          duration: taskDurationSec 
        } 
      }
    );

    // Update subsequent tasks
    const { subsequentTask, updatedProperties } = await updateSubsequentTasks(
      db, 
      data.sessionId, 
      currentTask.task_order, 
      gameConfig,
      logger
    );

    // Log beginning of next task if exists
    if (subsequentTask) {
      await logger.logTaskBegin(subsequentTask.taskId);
    }

    // Get updated tasks with metadata
    const updatedTasks = await getUpdatedTasksWithMetadata(db, data.sessionId, gameConfig);

    // Emit game update to client
    socket.emit('game-update', {
      updatedTasks: updatedTasks,
      updatedProperties: updatedProperties,
      message: "You completed a task!",
      sessionId: data.sessionId,
    });
  }
}