/**
 * Search for a specific property value of a device in the devices array
 * @param {string} device - The device ID to search for
 * @param {string} property - The property name to search for
 * @param {Array} devices - Array of devices with their interactions
 * @returns {*} The value of the property if found, null otherwise
 */
export function searchDeviceAndProperty(device, property, devices) {
  for (let i = 0; i < devices.length; i++) {
    if (devices[i].deviceId === device) {
      for (let j = 0; j < devices[i].deviceInteraction.length; j++) {
        if (devices[i].deviceInteraction[j].name === property) {
          return devices[i].deviceInteraction[j].value;
        }
      }
    }
  }
  return null;
}