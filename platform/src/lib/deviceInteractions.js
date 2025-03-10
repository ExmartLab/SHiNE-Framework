/**
 * Functions for handling device interactions
 */

/**
 * Updates a device interaction in the database
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - The interaction data containing device, sessionId, interaction, and value
 * @returns {Promise<boolean>} - Returns true if update was successful, false otherwise
 */
export async function updateDeviceInteraction(db, data) {
  try {
    // Find the device in the database
    const device = await db.collection('devices').findOne({ 
      deviceId: data.device, 
      userSessionId: data.sessionId 
    });
    
    // If device exists, update the interaction
    if (device) {
      const deviceInteraction = device.deviceInteraction;
      
      // Find the specific interaction to update
      for (let i = 0; i < deviceInteraction.length; i++) {
        if (deviceInteraction[i].name === data.interaction) {
          deviceInteraction[i].value = data.value;
          break;
        }
      }
      
      // Update the device in the database
      await db.collection('devices').updateOne(
        { deviceId: data.device, userSessionId: data.sessionId },
        { $set: { deviceInteraction: deviceInteraction } }
      );
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating device interaction:', error);
    return false;
  }
}