import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { PERMISSIONS, request, requestMultiple } from "react-native-permissions";
import * as ExpoDevice from "expo-device";
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
} from "react-native-ble-plx";
import { SERVICE_UUID, CHARACTERISTIC_UUID } from "@/utils/ble_constants";

const bleManager = new BleManager({
  restoreStateIdentifier: 'sync-sonic-ble',
  restoreStateFunction: (restoredState) => {
    console.log('BLE Manager state restored:', restoredState);
  }
});

type NotificationHandler = (error: BleError | null, characteristic: Characteristic | null) => void;

export function useBLE(onNotification?: NotificationHandler) {
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [pendingDevices, setPendingDevices] = useState<Device[]>([]);
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      if (isScanning) {
        bleManager.stopDeviceScan();
      }
      bleManager.destroy();
    };
  }, [isScanning, updateTimeout]);

  const batchUpdateDevices = () => {
    if (pendingDevices.length > 0) {
      setAllDevices(prev => {
        const newDevices = pendingDevices.filter(newDevice => 
          !prev.some(existingDevice => existingDevice.id === newDevice.id)
        );
        return [...prev, ...newDevices];
      });
      setPendingDevices([]);
    }
  };

  const ensurePiNotifications = async (
    dev: Device,
    onNotify: (e: BleError | null, c: Characteristic | null) => void
  ) => {
    // already monitoring?  (Ble-plx keeps listeners here)
    // @ts-ignore – not in typings but exists at runtime
    if (dev.monitorListeners?.length) return;
  
    console.log('[BLE] discovering SVC/CHR for', dev.id);
    const d2        = await dev.discoverAllServicesAndCharacteristics();
    const svcs      = await d2.services();
    const svc       = svcs.find(
      s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()
    );
    if (!svc) throw new Error('Pi service not found');
  
    const chrs      = await svc.characteristics();
    const chr       = chrs.find(
      c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase()
    );
    if (!chr) throw new Error('Pi characteristic not found');
  
    console.log('[BLE] enabling notifications …');
    await chr.monitor((err, c) => {
      if (err) console.error('[BLE] monitor error:', err);
      else     console.log('[BLE] NOTIFY raw:', c?.value);
      onNotify(err, c);
    });
  }

  const isDuplicateDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForPeripherals = () => {
    console.log('Starting BLE scan...');
    
    // Stop any existing scan
    bleManager.stopDeviceScan();
    
    // Clear any pending updates
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    setPendingDevices([]);
    
    // Simple scanning options that worked in the old version
    const scanOptions = {
      allowDuplicates: false,
      scanMode: 2, // SCAN_MODE_LOW_LATENCY
    };
    
    console.log('Using scan options:', scanOptions);
    
    bleManager.startDeviceScan(
      null,
      scanOptions,
      async (error, device) => {
        if (error) {
          console.error('BLE scan error:', error);
          return;
        }
        if (device) {
          try {
            // Log device details
            console.log('Found device:', {
              id: device.id,
              name: device.name,
              localName: device.localName,
              rssi: device.rssi,
              serviceUUIDs: device.serviceUUIDs
            });
            
            // Only add devices with names
            if (device.name || device.localName) {
              // Add to pending devices if not already present
              setPendingDevices(prev => {
                if (!prev.some(d => d.id === device.id)) {
                  const newDevices = [...prev, device];
                  // Update allDevices immediately with new devices
                  setAllDevices(current => {
                    const existingIds = new Set(current.map(d => d.id));
                    const newDevicesToAdd = newDevices.filter(d => !existingIds.has(d.id));
                    return [...current, ...newDevicesToAdd];
                  });
                  return newDevices;
                }
                return prev;
              });
            }
          } catch (e) {
            console.error('Error processing device:', e);
          }
        }
      }
    );
  };

  const stopScan = () => {
    console.log('Stopping BLE scan...');
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      batchUpdateDevices(); // Process any remaining pending devices
    }
    bleManager.stopDeviceScan();
  };

  const connectToDevice = async (device: Device) => {
    try {
      console.log('Connecting to device:', device.id);
      
      // Stop scanning before attempting to connect
      if (isScanning) {
        console.log('Stopping scan before connecting...');
        stopScan();
        setIsScanning(false);
        
        // Add a small delay to allow the BLE stack to clean up
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Ensure scanning is stopped
      bleManager.stopDeviceScan();
      
      const deviceConnection = await bleManager.connectToDevice(device.id, {
        timeout: 10000, // 10 second timeout
        autoConnect: false // Don't auto-connect
      });
      
      setConnectedDevice(deviceConnection);
      
      // Discover services and characteristics
      await deviceConnection.discoverAllServicesAndCharacteristics();

      // Set up notification handler if provided
      if (onNotification) {
        await deviceConnection.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          (err, char) => {
            console.log('[BLE] monitor callback fired'); 
            console.log('[BLE] NOTIFY raw:', char?.value);   // <-- base-64 packet
            onNotification?.(err, char);                     // existing path
          }
        );
      }

      return deviceConnection;
    } catch (e) {
      console.error("Failed to connect:", e);
      throw e;
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const apiLevel = ExpoDevice.platformApiLevel;
      if (apiLevel === null) {
        console.error('Could not determine Android API level');
        return false;
      }
      
      if (apiLevel < 31) {
        const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        return result === 'granted';
      } else {
        const results = await requestMultiple([
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]);
        return (
          results[PERMISSIONS.ANDROID.BLUETOOTH_SCAN] === 'granted' &&
          results[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] === 'granted' &&
          results[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === 'granted'
        );
      }
    } else {
      return true;
    }
  };

  return {
    scanForPeripherals,
    stopScan,
    connectToDevice,
    allDevices,
    connectedDevice,
    isScanning,
    requestPermissions
  };
}

export default useBLE;