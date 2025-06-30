/**
 * Updates a device interaction in the database and optionally returns logging data.
 * 
 * This function is the primary mechanism for persisting device state changes during
 * user interactions in the smart home simulation. It locates the specific device
 * and interaction by ID, updates the value, and stores the change in MongoDB.
 * 
 * The function supports optional logging mode which returns structured data
 * for external logging systems or explanation engines.
 * 
 * @param {Object} db - MongoDB database connection instance
 * @param {Object} data - The interaction data object containing:
 *   - device: String device identifier
 *   - sessionId: User session identifier for device ownership
 *   - interaction: Name of the device interaction/property to update
 *   - value: New value to set for the interaction
 * @param {boolean} [log=false] - Whether to return logging data instead of boolean result
 * @returns {Promise<boolean|Object>} Returns true if update successful, false if failed,
 *   or logging data object if log parameter is true
 * 
 * @example
 * // Update a light switch interaction
 * const success = await updateDeviceInteraction(db, {
 *   device: 'living-room-light',
 *   sessionId: 'user123',
 *   interaction: 'power',
 *   value: true
 * });
 * 
 * @example
 * // Update with logging data returned
 * const logData = await updateDeviceInteraction(db, data, true);
 * // Returns: { device_id: 'device123', interaction: { name: 'power', value: true } }
 */
export async function updateDeviceInteraction(db, data, log = false) {
  try {
    // Locate the device document in the database by device ID and session
    const device = await db.collection('devices').findOne({ 
      deviceId: data.device, 
      userSessionId: data.sessionId 
    });
    
    // Proceed only if device exists for this session
    if (device) {
      const deviceInteraction = device.deviceInteraction;
      
      // Search through device interactions to find the target interaction
      for (let i = 0; i < deviceInteraction.length; i++) {
        if (deviceInteraction[i].name === data.interaction) {
          // Update the interaction value
          deviceInteraction[i].value = data.value;
          break;
        }
      }
      
      // Persist the updated device interaction array to database
      await db.collection('devices').updateOne(
        { deviceId: data.device, userSessionId: data.sessionId },
        { $set: { deviceInteraction: deviceInteraction } }
      );

      // Return logging data if requested (for explanation engines, analytics, etc.)
      if(log){
        let logData = {
          device_id: data.device,
          interaction: {
            name: data.interaction,
            value: data.value,
          },
        };
        return logData;
      }
      
      return true;
    }
    
    // Return false if device was not found
    return false;
  } catch (error) {
    console.error('Error updating device interaction:', error);
    return false;
  }
}

/**
 * Search for a specific property value of a device in the devices array.
 * 
 * This utility function provides efficient lookup of device property values
 * from an array of device objects. It's commonly used for rule evaluation,
 * status checking, and conditional logic in the smart home simulation.
 * 
 * The function performs a nested search: first locating the device by ID,
 * then searching through its interactions/properties to find the target property.
 * 
 * @param {string} device - The device ID to search for
 * @param {string} property - The property/interaction name to search for
 * @param {Array} devices - Array of device objects, each containing:
 *   - deviceId: String identifier for the device
 *   - deviceInteraction: Array of interaction objects with name/value pairs
 * @returns {*} The value of the property if found, null if not found
 * 
 * @example
 * // Search for the power state of a specific light
 * const powerState = searchDeviceAndProperty('living-room-light', 'power', devicesArray);
 * // Returns: true, false, or null if not found
 * 
 * @example
 * // Search for temperature setting of a thermostat
 * const temp = searchDeviceAndProperty('main-thermostat', 'temperature', devicesArray);
 * // Returns: numeric value or null
 */
export function searchDeviceAndProperty(device, property, devices) {
  // Iterate through all devices to find the target device
  for (let i = 0; i < devices.length; i++) {
    if (devices[i].deviceId === device) {
      // Device found, now search through its interactions
      for (let j = 0; j < devices[i].deviceInteraction.length; j++) {
        if (devices[i].deviceInteraction[j].name === property) {
          // Property found, return its current value
          return devices[i].deviceInteraction[j].value;
        }
      }
    }
  }
  // Return null if device or property not found
  return null;
}