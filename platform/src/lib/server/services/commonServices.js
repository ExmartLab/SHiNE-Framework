// src/lib/server/services/commonServices.js
import { searchDeviceAndProperty } from "../../deviceUtils.js";
import Metadata from "../logger/metadata.js";
import Logger from "../logger/logger.js";

/**
 * Validate session and update socket ID if necessary
 * @param {Object} socket - Socket connection
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @returns {Object|null} - User session object or null if invalid
 */
export async function validateSession(socket, db, sessionId) {
    if (!sessionId) return null;

    const userSession = await db.collection('sessions').findOne({ sessionId });
    if (!userSession || userSession.isCompleted) return null;

    // Update socket id if necessary
    if (userSession.socketId !== socket.id) {
        await db.collection('sessions').updateOne(
            { sessionId },
            { $set: { socketId: socket.id } }
        );
    }

    return userSession;
}

/**
 * Get current active task for a user
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @returns {Object|null} - Current task or null if not found
 */
export async function getCurrentTask(db, sessionId) {
    const currentTime = new Date();
    return await db.collection('tasks').findOne({
        userSessionId: sessionId,
        startTime: { $lte: currentTime },
        endTime: { $gte: currentTime }
    });
}

/**
 * Create and initialize logger instance
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @param {Object} gameConfig - Game configuration
 * @param {Object} explanationEngine - Explanation engine instance
 * @returns {Object} - Logger instance
 */
export async function createLogger(db, sessionId, gameConfig, explanationEngine) {
    const metadataEngine = new Metadata(db, gameConfig, sessionId);
    await metadataEngine.loadUserData();
    return new Logger(db, sessionId, metadataEngine, explanationEngine);
}

/**
 * Update task times when transitioning to next task
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @param {number} currentTaskOrder - Current task order
 * @param {Object} gameConfig - Game configuration
 * @param {Object} logger - Logger instance
 * @returns {Object} - Info about updated tasks and properties
 */
export async function updateSubsequentTasks(db, sessionId, currentTaskOrder, gameConfig, logger = null) {
    // First, check for any "hanging" previous tasks and mark them as timed out
    const currentTime = new Date();
    const incompletePreviousTasks = await db.collection('tasks').find({
        userSessionId: sessionId,
        task_order: { $lt: currentTaskOrder },
        isCompleted: { $ne: true },
        isTimedOut: { $ne: true },
        isAborted: { $ne: true },
        endTime: { $lt: currentTime }
    }).toArray();

    // Mark all incomplete previous tasks as timed out
    for (const task of incompletePreviousTasks) {
        const taskDurationSec = (task.endTime.getTime() - task.startTime.getTime()) / 1000;

        await db.collection('tasks').updateOne(
            { _id: task._id },
            {
                $set: {
                    isTimedOut: true,
                    duration: taskDurationSec
                }
            }
        );

        // Log the timeout if logger is provided
        if (logger) {
            await logger.logTaskTimeout(task.taskId);
        }
    }

    // Continue with updating subsequent tasks
    const subsequentTasks = await db.collection('tasks').find({
        userSessionId: sessionId,
        task_order: { $gt: currentTaskOrder }
    }).toArray();

    const updatedProperties = [];
    let subsequentTask = null;

    if (subsequentTasks.length > 0) {
        let startTimeSubsequent = new Date();
        let endTimeSubsequent = new Date();
        let globalTaskTimer = gameConfig.tasks.timer * 1000;

        for (let i = 0; i < subsequentTasks.length; i++) {
            if (i === 0) {
                subsequentTask = subsequentTasks[i];
            }

            // Start time
            startTimeSubsequent = endTimeSubsequent;

            // Determine task duration
            const taskConfig = gameConfig.tasks.tasks.find(task => task.id === subsequentTasks[i].taskId);
            const individualTaskTimer = taskConfig?.timer !== undefined ? taskConfig.timer : globalTaskTimer / 1000;

            endTimeSubsequent = new Date(startTimeSubsequent.getTime() + individualTaskTimer * 1000);

            // Update task times
            await db.collection('tasks').updateOne(
                {
                    userSessionId: sessionId,
                    taskId: subsequentTasks[i].taskId
                },
                {
                    $set: {
                        startTime: startTimeSubsequent,
                        endTime: endTimeSubsequent
                    }
                }
            );
        }

        // Update device properties for the next task
        if (subsequentTask) {
            const taskConfig = gameConfig.tasks.tasks.find(task => task.id === subsequentTask.taskId);
            const defaultDeviceProperties = taskConfig?.defaultDeviceProperties || [];

            for (const deviceProp of defaultDeviceProperties) {
                const currentDeviceProperty = await db.collection('devices').findOne({
                    userSessionId: sessionId,
                    deviceId: deviceProp.device
                });

                if (currentDeviceProperty) {
                    const updatedInteractions = [...currentDeviceProperty.deviceInteraction];

                    for (const property of deviceProp.properties) {
                        const interactionIndex = updatedInteractions.findIndex(
                            interaction => interaction.name === property.name
                        );

                        if (interactionIndex !== -1) {
                            updatedInteractions[interactionIndex].value = property.value;
                            updatedProperties.push({
                                device: deviceProp.device,
                                interaction: property.name,
                                value: property.value
                            });
                        }
                    }

                    await db.collection('devices').updateOne(
                        {
                            userSessionId: sessionId,
                            deviceId: deviceProp.device
                        },
                        {
                            $set: {
                                deviceInteraction: updatedInteractions
                            }
                        }
                    );
                }
            }
        }
    }

    return {
        subsequentTask,
        updatedProperties
    };
}

/**
 * Update all tasks with additional metadata
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @param {Object} gameConfig - Game configuration
 * @returns {Array} - Updated tasks
 */
export async function getUpdatedTasksWithMetadata(db, sessionId, gameConfig) {
    const updatedTasks = await db.collection('tasks').find({
        userSessionId: sessionId
    }).toArray();

    const globalAbortable = gameConfig.tasks.abortable ?? true;

    for (const task of updatedTasks) {
        const matchedTask = gameConfig.tasks.tasks.find(t => t.id === task.taskId);

        if (matchedTask) {
            task.abortionOptions = matchedTask.abortionOptions || [];
            task.abortable = matchedTask.abortable !== null ? matchedTask.abortable : globalAbortable;
            task.environment = matchedTask.environment || [];
        }
    }

    return updatedTasks;
}

/**
 * Check if a task's goals are met
 * @param {Object} db - MongoDB database connection
 * @param {string} sessionId - User session ID
 * @param {Object} taskDetail - Task details
 * @param {Array} devices - Device states
 * @returns {boolean} - Whether all goals are met
 */
export function checkTaskGoals(taskDetail, devices) {
    if (!taskDetail.goals || taskDetail.goals.length === 0) {
        return false;
    }

    for (const goal of taskDetail.goals) {
        const deviceValue = searchDeviceAndProperty(goal.device, goal.condition.name, devices);

        if (deviceValue === null) {
            return false;
        }

        let goalMet = false;

        switch (goal.condition.operator) {
            case '==':
                goalMet = deviceValue == goal.condition.value;
                break;
            case '!=':
                goalMet = deviceValue != goal.condition.value;
                break;
            case '<':
                goalMet = deviceValue < goal.condition.value;
                break;
            case '>':
                goalMet = deviceValue > goal.condition.value;
                break;
            case '<=':
                goalMet = deviceValue <= goal.condition.value;
                break;
            case '>=':
                goalMet = deviceValue >= goal.condition.value;
                break;
            default:
                goalMet = false;
                break;
        }

        if (!goalMet) {
            return false;
        }
    }

    return true;
}

/**
 * Get injectable variables from user data
 * @param {Object} userData - User data
 * @returns {Object} - Injectable variables
 */
export function getInjectibleVariables(userData) {
    const injectibleVariables = {};

    if (userData.customData) {
        for (const property in userData.customData) {
            injectibleVariables[property] = userData.customData[property];
        }
    }

    return injectibleVariables;
}

/**
 * Calculate in-game time based on real time
 * @param {Date} startTime - Game start time
 * @param {Object} gameConfig - Game configuration
 * @returns {Object} - In-game time
 */
export function getInGameTime(startTime, gameConfig) {
    const currentTime = new Date();
    const timeDifference = ((currentTime.getTime() - startTime.getTime()) / 1000) * gameConfig.environment.time.speed;

    // Based on start time
    let minute = gameConfig.environment.time.startTime.minute + Math.floor(timeDifference / 60);
    let hour = gameConfig.environment.time.startTime.hour + Math.floor(minute / 60);
    minute = (minute % 60);
    hour = (hour % 24);

    return { hour, minute };
}