import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Device, Characteristic, BleError, Service } from "react-native-ble-plx";
import useBLE from "@/hooks/useBLE";
import { Alert, Platform, NativeModules } from 'react-native';
import { saveLastConnectedDevice, 
          getLastConnectedDevice,
          updateSpeakerConnectionStatus,
          updateConnectionStatus,
          getConfigurations,
          getSpeakers } from '@/app/database';
import bleManager from "@/services/BLEManager";
import { getConnectedDevices } from "@/services/BLEManager";
import { RPI_DEVICE_NAME, SERVICE_UUID, CHARACTERISTIC_UUID, MESSAGE_TYPES } from '@/utils/ble_constants';
import { fetchPairedDevices } from '../utils/ble_functions';

async function applyConnectedList(macList: string[]) {
  try {
    // 1) one pass: mark each speaker row
    const allConfigs = getConfigurations();           // existing helper
    const macSet = new Set(macList.map(m => m.toUpperCase()));

    allConfigs.forEach(cfg => {
      const spkRows = getSpeakers(cfg.id);
      let anyUp = false;

      spkRows.forEach(row => {
        const up = macSet.has(row.mac.toUpperCase());
        if (up) anyUp = true;
        updateSpeakerConnectionStatus(cfg.id, row.mac, up);
      });

      // 2) update the configuration flag
      updateConnectionStatus(cfg.id, anyUp ? 1 : 0);
    });
  } catch (e) {
    console.error("applyConnectedList:", e);
  }
}

// Add type declarations
declare module 'react-native' {
  interface AlertStatic {
    alert: (title: string, message?: string, buttons?: any[], options?: any) => void;
  }
  interface PlatformStatic {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
  }
  interface NativeModulesStatic {
    [key: string]: any;
  }
}

interface BLEMessageDevice {
  id: string;
  name: string;
}

interface MessageData {
  count?: number;
  devices?: BLEMessageDevice[];
  connected?: string[]; 
}

interface DecodedMessage {
  messageType: number;
  data: MessageData;
}

interface BLEContextType {
  connectedDevice: Device | null;
  isConnected: boolean;
  pingCount: number;
  pongCount: number;
  isPinging: boolean;
  allDevices: Device[];
  rpiDevices: Device[];
  scanning: boolean;
  pairedDevices: Record<string, string>;
  connectToDevice: (device: Device) => Promise<void>;
  sendPing: () => Promise<void>;
  disconnectDevice: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  scanForPeripherals: () => void;
  scanForBLEDevices: () => Promise<void>;
  scanForSpeakerDevices: () => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  getDevices: () => Promise<any[]>;
  pairDevices: (devices: any[]) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setLatency: (latency: number) => Promise<void>;
  getPairedDevices: () => Promise<Record<string, string>>;
  reconnectToLastDevice: () => Promise<void>;
  saveLastConnectedDevice: (device: Device) => void;
  sendMessage: (messageType: number, data?: any) => Promise<void>;
}

const BLEContext = createContext<BLEContextType | null>(null);

export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pingCount, setPingCount] = useState(0);
  const [pongCount, setPongCount] = useState(0);
  const [isPinging, setIsPinging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<Record<string, string>>({});
  const [allDevices, setAllDevices] = useState<Device[]>([]);

  const handleMessage = async (error: any, characteristic: any) => {
    if (error) {
      console.error('Error in characteristic notification:', error);
      return;
    }

    try {
      const decoded = decodeMessage(characteristic.value);
      if (!decoded) return;

      console.log('Received message:', decoded);

      switch (decoded.messageType) {
        case MESSAGE_TYPES.PONG:
          setPongCount(prev => prev + 1);
          break;
        case MESSAGE_TYPES.SUCCESS: {
            // ── 1. Whatever you were already doing ───────────────────────────────
            console.log("Operation successful");
          
            // ── 2. NEW: did the Pi include the "connected" array? ────────────────
            if (Array.isArray(decoded.data.connected)) {
              // write the list into SQLite → screens update automatically
              await applyConnectedList(decoded.data.connected);
            }
            break;
          }
        case MESSAGE_TYPES.FAILURE:
          console.error('Operation failed');
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
        u => u.toLowerCase() === SERVICE_UUID.toLowerCase()
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
        const connectedDevices = await getConnectedDevices([SERVICE_UUID]);
        console.log('Found connected devices:', connectedDevices);
        
        if (connectedDevices.length > 0) {
          const rpiDevice = connectedDevices.find((device: Device) => device.name === RPI_DEVICE_NAME);
          if (rpiDevice) {
            console.log('Found already connected RPI device:', rpiDevice.id);
            // Only connect if we don't already have a connected device
            if (!connectedDevice || connectedDevice.id !== rpiDevice.id) {
              await connectToDevice(rpiDevice);
            } else {
              console.log('Device already connected, skipping connection attempt');
            }
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

  const scanForSpeakerDevices = async () => {
    try {
      setScanning(true);
      console.log('Starting speaker device scan...');
      
      const isPermissionsEnabled = await requestPermissions();
      if (!isPermissionsEnabled) {
        console.log('BLE permissions not granted');
        Alert.alert('Error', 'Bluetooth permissions are required to scan for devices');
        setScanning(false);
        return;
      }

      // Start scanning for devices
      scanForPeripherals();
      
      // Keep scanning for 30 seconds
      setTimeout(() => {
        console.log('Stopping speaker device scan...');
        stopScan();
        setScanning(false);
      }, 30000);
    } catch (error) {
      console.error('Error during speaker device scan:', error);
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
      // Check if the device is already connected
      if (connectedDevice && connectedDevice.id === lastDeviceId) {
        console.log('Device already connected, skipping reconnection');
        return;
      }

      // Look for the device in the already scanned devices first
      const device = rpiDevices.find(d => d.id === lastDeviceId);
      if (device) {
        console.log('Found device in existing devices, connecting...');
        await connectToDevice(device);
      } else {
        // If not found, start a scan to find it
        console.log('Device not found in existing devices, starting scan...');
        await scanForBLEDevices();
      }
    } catch (error) {
      console.log('Reconnection failed:', error);
    }
  };

  const encodeMessage = (messageType: number, data: any = {}) => {
    /* PING with {count:n} can be kept compact */
    if (messageType === MESSAGE_TYPES.PING) {
      const buf   = new ArrayBuffer(5);
      const view  = new DataView(buf);
      view.setUint8 (0, messageType);
      view.setUint32(1, data.count ?? 0, false);   // big-endian
      return btoa(String.fromCharCode(...new Uint8Array(buf)));
    }
  
    /* everything else → JSON payload */
    const json     = JSON.stringify(data);
    const bytes    = new TextEncoder().encode(json);
    const packet   = new Uint8Array(1 + bytes.length);
    packet[0]      = messageType;
    packet.set(bytes, 1);
    return btoa(String.fromCharCode(...packet));
  };
  
  const decodeMessage = (value: string): DecodedMessage | null => {
    if (!value) return null;
    try {
      const buffer = Buffer.from(value, 'base64');
      const messageType = buffer[0];
      const jsonBytes = buffer.slice(1);
      const data = JSON.parse(jsonBytes.toString('utf8'));
      
      return {
        messageType,
        data
      };
    } catch (err) {
      console.error("decodeMessage failed:", err);
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
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        message
      );
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // BLE API Methods
  const startScan = async () => {
    throw new Error('Scanning not supported by backend');
  };

  const getDevices = async () => {
    throw new Error('Device scanning not supported by backend');
  };

  const pairDevices = async (devices: any[]) => {
    throw new Error('Pairing not supported by backend');
  };

  const setVolume = async (volume: number) => {
    await sendMessage(MESSAGE_TYPES.SET_VOLUME, { volume });
  };

  const setLatency = async (latency: number) => {
    await sendMessage(MESSAGE_TYPES.SET_LATENCY, { latency });
  };

  const getPairedDevices = async () => {
    if (!connectedDevice) throw new Error('No device connected');
    return fetchPairedDevices(connectedDevice);
  };

  const connectToDevice = async (device: Device) => {
    // Check if we're already connected to this device
    if (connectedDevice && connectedDevice.id === device.id) {
      console.log('Already connected to this device, skipping connection attempt');
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds between retries

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempting connection (attempt ${retryCount + 1}/${maxRetries})...`);
        
        // Stop scanning and update state
        if (scanning) {
          console.log('Stopping scan before connecting...');
          await stopScan();
          setScanning(false);
          
          // Add a small delay to allow the BLE stack to clean up
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Add a delay before attempting connection to allow any previous connections to fully close
        if (retryCount > 0) {
          console.log(`Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        const connectedDevice = await device.connect({
          timeout: 10000, // 10 second timeout
          autoConnect: false // Don't auto-connect
        });
        
        console.log('Connected to device:', connectedDevice.id);
        
        // Add a delay before service discovery to allow the connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry service discovery up to 3 times
        let discoveredDevice: Device | null = null;
        let services: Service[] = [];
        let serviceRetryCount = 0;
        const maxServiceRetries = 3;
        
        while (serviceRetryCount < maxServiceRetries) {
          try {
            console.log(`Attempting service discovery (attempt ${serviceRetryCount + 1}/${maxServiceRetries})...`);
            discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
            console.log('Discovered services and characteristics');
            
            services = await discoveredDevice.services();
            console.log('Found services:', services.map(s => ({
              uuid: s.uuid,
              isPrimary: s.isPrimary,
              deviceID: s.deviceID
            })));
            
            // Check if our service is found
            const targetService = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
            if (targetService) {
              console.log('Found target service:', targetService.uuid);
              break;
            }
            
            console.log('Target service not found, retrying...');
            serviceRetryCount++;
            if (serviceRetryCount < maxServiceRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(`Service discovery attempt ${serviceRetryCount + 1} failed:`, error);
            serviceRetryCount++;
            if (serviceRetryCount < maxServiceRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        if (serviceRetryCount === maxServiceRetries) {
          throw new Error(`Failed to discover services after ${maxServiceRetries} attempts`);
        }
        
        // Find the service with the correct UUID
        const targetService = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
        if (!targetService) {
          console.error('Service not found. Looking for:', SERVICE_UUID);
          console.error('Available services:', services.map(s => s.uuid));
          throw new Error('Service not found');
        }
        
        // Find the characteristic with the correct UUID
        const characteristics = await targetService.characteristics();
        console.log('Found characteristics:', characteristics.map((c: Characteristic) => ({
          uuid: c.uuid,
          serviceUUID: c.serviceUUID
        })));
        
        const targetCharacteristic = characteristics.find((c: Characteristic) => c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase());
        if (!targetCharacteristic) {
          console.error('Characteristic not found. Looking for:', CHARACTERISTIC_UUID);
          console.error('Available characteristics:', characteristics.map((c: Characteristic) => c.uuid));
          throw new Error('Characteristic not found');
        }

        // Only try to enable notifications if we don't already have them set up
        if (!isConnected) {
          // Try to enable notifications with retries
          let notificationRetryCount = 0;
          const maxNotificationRetries = 3;
          let notificationSuccess = false;

          while (notificationRetryCount < maxNotificationRetries) {
            try {
              console.log(`Attempting to enable notifications (attempt ${notificationRetryCount + 1}/${maxNotificationRetries})...`);
              await targetCharacteristic.monitor((error: BleError | null, characteristic: Characteristic | null) => {
                if (error) {
                  console.error('Error in characteristic notification:', error);
                  return;
                }
                handleMessage(error, characteristic);
              });
              notificationSuccess = true;
              break;
            } catch (error) {
              console.error(`Notification setup attempt ${notificationRetryCount + 1} failed:`, error);
              notificationRetryCount++;
              if (notificationRetryCount < maxNotificationRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (!notificationSuccess) {
            console.warn('Failed to set up notifications after multiple attempts, but connection is established');
            // We'll still consider this a successful connection even if notifications fail
          }
        }
        
        setConnectedDevice(connectedDevice);
        setIsConnected(true);
        console.log('Successfully connected and set up notifications');
        return; // Successfully connected, exit the retry loop
      } catch (error) {
        console.error(`Connection attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        
        // If we've exhausted all retries, clean up and throw the error
        if (retryCount === maxRetries) {
          console.error('All connection attempts failed');
          if (scanning) {
            await stopScan();
            setScanning(false);
          }
          throw error;
        }
        
        // If this is a pairing-related error, add an additional delay
        if (error instanceof Error && error.message?.includes('pairing')) {
          console.log('Pairing error detected, adding extra delay...');
          await new Promise(resolve => setTimeout(resolve, retryDelay * 2));
        }
      }
    }
  };

  const disconnectFromDevice = async () => {
    if (!connectedDevice) return;
    
    try {
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      setIsConnected(false);
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

  const checkAllBluetoothConnections = async (): Promise<boolean> => {
    try {
      // First check if we have a connected device and if it's still connected
      if (connectedDevice) {
        try {
          const isStillConnected = await connectedDevice.isConnected();
          if (isStillConnected) {
            return true;
          }
        } catch (error) {
          console.log('Error checking device connection status:', error);
        }
      }
      
      // If we don't have a connected device or it's not connected, check for BLE connections
      try {
        const bleDevices = await bleManager.connectedDevices([SERVICE_UUID]);
        if (bleDevices.length > 0) {
          const rpiDevice = bleDevices.find((device: Device) => device.name === RPI_DEVICE_NAME);
          if (rpiDevice) {
            // Update our state to match the BLE system
            setConnectedDevice(rpiDevice);
            setIsConnected(true);
            return true;
          }
        }
      } catch (error) {
        console.log('Error checking BLE connections:', error);
      }

      return false;
    } catch (error) {
      console.error('Error checking all Bluetooth connections:', error);
      return false;
    }
  };

  // Add useEffect to monitor connection status
  useEffect(() => {
    let isMounted = true;
    let checkTimeout: NodeJS.Timeout;

    const checkConnection = async () => {
      if (!isMounted) return;

      const isActuallyConnected = await checkAllBluetoothConnections();
      
      // Only update state if there's a mismatch and we're not in the middle of a connection attempt
      if (isActuallyConnected !== isConnected && !scanning) {
        setIsConnected(isActuallyConnected);
        if (!isActuallyConnected) {
          setConnectedDevice(null);
        }
      }

      // Schedule next check
      if (isMounted) {
        checkTimeout = setTimeout(checkConnection, 5000);
      }
    };

    // Start the first check
    checkConnection();

    // Cleanup
    return () => {
      isMounted = false;
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
  }, [isConnected, connectedDevice, scanning]);

  const stopScan = async () => {
    stopScanHook();
    setScanning(false);
  };

  return (
    <BLEContext.Provider
      value={{
        connectedDevice,
        isConnected,
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
        scanForSpeakerDevices,
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
      }}
    >
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