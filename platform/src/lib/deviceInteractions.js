/**
 * Functions for handling device interactions
 */

/**
 * Updates a device interaction in the database
 * @param {Object} db - MongoDB database connection
 * @param {Object} data - The interaction data containing device, sessionId, interaction, and value
 * @returns {Promise<boolean>} - Returns true if update was successful, false otherwise
 */
export async function updateDeviceInteraction(db, data, log = false) {
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

      if(log){
        let logData = {
          userSessionId: data.sessionId,
          type: "DEVICE_INTERACTION",
          device_id: data.device,
          interaction: {
            name: data.interaction,
            value: data.value,
          },
          timestamp: Math.floor(new Date().getTime() / 1000),
        };
        return logData;
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating device interaction:', error);
    return false;
  }
}