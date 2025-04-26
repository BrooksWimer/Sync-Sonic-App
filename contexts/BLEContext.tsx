import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Device, Characteristic, BleError } from "react-native-ble-plx";
import useBLE from "@/hooks/useBLE";
import { Alert } from 'react-native';
import { saveLastConnectedDevice, getLastConnectedDevice } from '@/app/database';
import bleManager from "@/services/BLEManager";
import { getConnectedDevices } from "@/services/BLEManager";

// BLE Constants
export const RPI_DEVICE_NAME = "Sync-Sonic";
export const RPI_SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const RPI_CHARACTERISTIC_UUID = "19b10001-e8f2-537e-4f6c-d104768a1217";

// Message Types
export const MESSAGE_TYPES = {
  // Scan related
  START_SCAN: 0x10,
  STOP_SCAN: 0x11,
  GET_DEVICES: 0x12,
  DEVICE_FOUND: 0x13,
  // Pairing related
  PAIR: 0x20,
  // Volume and latency
  SET_VOLUME: 0x30,
  SET_LATENCY: 0x31,
  // Connection related
  CONNECT: 0x40,
  DISCONNECT: 0x41,
  // Device management
  GET_PAIRED_DEVICES: 0x50,
  // Response types
  SUCCESS: 0xF0,
  FAILURE: 0xF1,
  // Ping/Pong
  PING: 0x01,
  PONG: 0x02,
  ERROR: 0x03
} as const;

interface BLEMessageDevice {
  id: string;
  name: string;
}

interface MessageData {
  count?: number;
  devices?: BLEMessageDevice[];
}

interface DecodedMessage {
  messageType: number;
  data: MessageData;
}

interface BLEContextType {
  connectedDevice: Device | null;
  pingCount: number;
  pongCount: number;
  isPinging: boolean;
  allDevices: Device[];
  rpiDevices: Device[];
  scanning: boolean;
  pairedDevices: any[];
  connectToDevice: (device: Device) => Promise<void>;
  sendPing: () => Promise<void>;
  disconnectDevice: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  scanForPeripherals: () => void;
  scanForBLEDevices: () => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  getDevices: () => Promise<any[]>;
  pairDevices: (devices: any[]) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setLatency: (latency: number) => Promise<void>;
  getPairedDevices: () => Promise<any[]>;
  reconnectToLastDevice: () => Promise<void>;
  saveLastConnectedDevice: (device: Device) => void;
  sendMessage: (messageType: number, data?: any) => Promise<void>;
}

const BLEContext = createContext<BLEContextType | null>(null);

export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [pongCount, setPongCount] = useState(0);
  const [isPinging, setIsPinging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [allDevices, setAllDevices] = useState<Device[]>([]);

  const handleMessage = (error: any, characteristic: any) => {
    if (error) {
      console.error('Error in characteristic notification:', error);
      return;
    }

    try {
      const decoded = decodeMessage(characteristic.value);
      if (!decoded) return;

      console.log('Received message:', decoded);

      switch (decoded.messageType) {
        case MESSAGE_TYPES.DEVICE_FOUND:
          if (decoded.data && decoded.data.devices) {
            setPairedDevices(prevDevices => {
              const newDevices = [...prevDevices];
              decoded.data.devices?.forEach((device: BLEMessageDevice) => {
                if (!newDevices.some(d => d.id === device.id)) {
                  newDevices.push(device);
                }
              });
              return newDevices;
            });
          }
          break;
        case MESSAGE_TYPES.PONG:
          setPongCount(prev => prev + 1);
          break;
        default:
          console.log('Unknown message type:', decoded.messageType);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  const {
    allDevices: bleAllDevices,
    connectToDevice: connectToDeviceHook,
    requestPermissions,
    scanForPeripherals,
    stopScan: stopScanHook
  } = useBLE(handleMessage);

  // Update allDevices when bleAllDevices changes
  useEffect(() => {
    console.log('BLE devices updated. Total devices:', bleAllDevices.length);
    setAllDevices(bleAllDevices);
  }, [bleAllDevices]);

  // Memoize the filtered RPI devices with a more stable dependency
  const rpiDevices = useMemo(() => {
    console.log('Filtering devices. Total devices:', allDevices.length);
    const filtered = allDevices.filter(device => {
      // Log device details for debugging
      console.log('Checking device:', {
        id: device.id,
        name: device.name,
        localName: device.localName,
        serviceUUIDs: device.serviceUUIDs
      });
      
      // Simple check that worked in the old version
      // New check: does this device advertise our Pi service?
      const isRpi = Array.isArray(device.serviceUUIDs) &&
      device.serviceUUIDs.some(
        u => u.toLowerCase() === RPI_SERVICE_UUID.toLowerCase()
      );
      
      if (isRpi) {
        console.log('Found RPI device:', {
          id: device.id,
          name: device.name,
          localName: device.localName,
          serviceUUIDs: device.serviceUUIDs
        });
      }
      return isRpi;
    });
    console.log('Found', filtered.length, 'RPI devices');
    return filtered;
  }, [allDevices]);

  const scanForBLEDevices = async () => {
    try {
      setScanning(true);
      console.log('Starting BLE scan...');
      
      // First check for already connected devices
      try {
        const connectedDevices = await getConnectedDevices([RPI_SERVICE_UUID]);
        console.log('Found connected devices:', connectedDevices);
        
        if (connectedDevices.length > 0) {
          const rpiDevice = connectedDevices.find((device: Device) => device.name === RPI_DEVICE_NAME);
          if (rpiDevice) {
            console.log('Found already connected RPI device:', rpiDevice.id);
            await connectToDevice(rpiDevice);
            setScanning(false);
            return;
          }
        }
      } catch (error) {
        console.log('Error checking connected devices:', error);
        // Continue with normal scan if there's an error
      }
      
      const isPermissionsEnabled = await requestPermissions();
      if (isPermissionsEnabled) {
        console.log('BLE permissions granted, starting scan...');
        scanForPeripherals();
      } else {
        console.log('BLE permissions not granted');
        Alert.alert('Error', 'Bluetooth permissions are required to scan for devices');
        setScanning(false);
        return;
      }
      
      // Keep scanning for 30 seconds
      setTimeout(() => {
        console.log('Stopping BLE scan...');
        console.log('Final devices list:', allDevices.map(d => ({
          id: d.id,
          name: d.name,
          localName: d.localName,
          serviceUUIDs: d.serviceUUIDs
        })));
        console.log('Final RPI devices:', rpiDevices.map(d => ({
          id: d.id,
          name: d.name,
          localName: d.localName,
          serviceUUIDs: d.serviceUUIDs
        })));
        stopScan();
        setScanning(false);
      }, 30000);
    } catch (error) {
      console.error('Error during BLE scan:', error);
      setScanning(false);
    }
  };

  // Save the last connected device ID
  const saveLastConnectedDeviceToDB = (device: Device) => {
    if (device?.id) {
      saveLastConnectedDevice(device.id);
    }
  };

  // Attempt to reconnect to the last connected device
  const reconnectToLastDevice = async () => {
    const lastDeviceId = await getLastConnectedDevice();
    if (!lastDeviceId) return;

    try {
      // Look for the device in the already scanned devices first
      const device = rpiDevices.find(d => d.id === lastDeviceId);
      if (device) {
        console.log('Found device in existing devices, connecting...');
        await connectToDevice(device);
      }
    } catch (error) {
      console.log('Reconnection failed:', error);
    }
  };

  const encodeMessage = (messageType: number, data: any = {}) => {
    // Create a 5-byte buffer
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    
    // Set message type in first byte
    view.setUint8(0, messageType);
    
    // Set count in next 4 bytes (big-endian)
    const count = data.count || 0;
    view.setUint32(1, count, false); // false for big-endian
    
    // Convert to base64
    const bytes = new Uint8Array(buffer);
    return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
  };

  const decodeMessage = (value: any): DecodedMessage | null => {
    if (!value) return null;
    
    try {
      const buffer = Buffer.from(value, 'base64');
      const messageType = buffer[0];
      const count = buffer.readUInt32BE(1);
      
      return {
        messageType,
        data: { count }
      };
    } catch (error) {
      console.error('Error decoding message:', error);
      return null;
    }
  };

  const sendMessage = async (messageType: number, data: any = {}) => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      const message = encodeMessage(messageType, data);
      await connectedDevice.writeCharacteristicWithResponseForService(
        RPI_SERVICE_UUID,
        RPI_CHARACTERISTIC_UUID,
        message
      );
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // BLE API Methods
  const startScan = async () => {
    await sendMessage(MESSAGE_TYPES.START_SCAN);
    setScanning(true);
  };

  const getDevices = async () => {
    await sendMessage(MESSAGE_TYPES.GET_DEVICES);
    
    // Wait for a short time to allow the response to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return pairedDevices;
  };

  const pairDevices = async (devices: any[]) => {
    await sendMessage(MESSAGE_TYPES.PAIR, { devices });
  };

  const setVolume = async (volume: number) => {
    await sendMessage(MESSAGE_TYPES.SET_VOLUME, { volume });
  };

  const setLatency = async (latency: number) => {
    await sendMessage(MESSAGE_TYPES.SET_LATENCY, { latency });
  };

  const getPairedDevices = async () => {
    await sendMessage(MESSAGE_TYPES.GET_PAIRED_DEVICES);
    // Response will be handled by handleMessage
    return pairedDevices;
  };

  const connectToDevice = async (device: Device) => {
    try {
      console.log('Connecting to device:', device.id);
      
      // Stop scanning and update state
      if (scanning) {
        console.log('Stopping scan before connecting...');
        await stopScan();
        setScanning(false);
        
        // Add a small delay to allow the BLE stack to clean up
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const connectedDevice = await device.connect({
        timeout: 10000, // 10 second timeout
        autoConnect: false // Don't auto-connect
      });
      
      console.log('Connected to device:', connectedDevice.id);
      
      const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
      console.log('Discovered services and characteristics');
      
      const services = await discoveredDevice.services();
      console.log('Found services:', services.map(s => ({
        uuid: s.uuid,
        isPrimary: s.isPrimary,
        deviceID: s.deviceID
      })));
      
      // Find the service with the correct UUID
      const targetService = services.find(s => s.uuid.toLowerCase() === RPI_SERVICE_UUID.toLowerCase());
      if (!targetService) {
        console.error('Service not found. Looking for:', RPI_SERVICE_UUID);
        console.error('Available services:', services.map(s => s.uuid));
        throw new Error('Service not found');
      }
      
      // Find the characteristic with the correct UUID
      const characteristics = await targetService.characteristics();
      console.log('Found characteristics:', characteristics.map(c => ({
        uuid: c.uuid,
        serviceUUID: c.serviceUUID
      })));
      
      const targetCharacteristic = characteristics.find(c => c.uuid.toLowerCase() === RPI_CHARACTERISTIC_UUID.toLowerCase());
      if (!targetCharacteristic) {
        console.error('Characteristic not found. Looking for:', RPI_CHARACTERISTIC_UUID);
        console.error('Available characteristics:', characteristics.map(c => c.uuid));
        throw new Error('Characteristic not found');
      }
      
      // Enable notifications
      await targetCharacteristic.monitor((error, characteristic) => {
        if (error) {
          console.error('Error monitoring characteristic:', error);
          return;
        }
        handleMessage(error, characteristic);
      });
      
      setConnectedDevice(connectedDevice);
      console.log('Successfully connected and set up notifications');
    } catch (error) {
      console.error('Error connecting to device:', error);
      // Clean up on error
      if (scanning) {
        await stopScan();
        setScanning(false);
      }
      throw error;
    }
  };

  const disconnectFromDevice = async () => {
    if (!connectedDevice) return;
    
    try {
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      console.log('Disconnected from device');
    } catch (error) {
      console.error('Error disconnecting from device:', error);
    }
  };

  const sendPing = async () => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      setIsPinging(true);
      await sendMessage(MESSAGE_TYPES.PING, { count: pingCount });
      setPingCount(prev => prev + 1);
      console.log('Sent PING to device');
    } catch (error) {
      console.error('Failed to send ping:', error);
      throw error;
    } finally {
      setIsPinging(false);
    }
  };

  // Add useEffect to attempt reconnection on app start
  useEffect(() => {
    const attemptReconnection = async () => {
      try {
        await reconnectToLastDevice();
      } catch (error) {
        console.log('Initial reconnection attempt failed:', error);
      }
    };

    attemptReconnection();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectedDevice) {
        disconnectFromDevice();
      }
    };
  }, []);

  const stopScan = async () => {
    stopScanHook();
    setScanning(false);
  };

  return (
    <BLEContext.Provider value={{
      connectedDevice,
      pingCount,
      pongCount,
      isPinging,
      allDevices,
      rpiDevices,
      scanning,
      pairedDevices,
      connectToDevice,
      sendPing,
      disconnectDevice: disconnectFromDevice,
      requestPermissions,
      scanForPeripherals,
      scanForBLEDevices,
      startScan,
      stopScan,
      getDevices,
      pairDevices,
      setVolume,
      setLatency,
      getPairedDevices,
      reconnectToLastDevice,
      saveLastConnectedDevice: saveLastConnectedDeviceToDB,
      sendMessage
    }}>
      {children}
    </BLEContext.Provider>
  );
};

export const useBLEContext = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLEContext must be used within a BLEProvider');
  }
  return context;
}; 