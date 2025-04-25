import { BleManager, Device } from 'react-native-ble-plx';

const bleManager = new BleManager({
  restoreStateIdentifier: 'sync-sonic-ble',
  restoreStateFunction: (restoredState) => {
    console.log('Restored BLE state:', restoredState);
  },
});

// Add getConnectedDevices method
export const getConnectedDevices = async (serviceUUIDs: string[]): Promise<Device[]> => {
  return await bleManager.connectedDevices(serviceUUIDs);
};

export default bleManager; 