import { useEffect, useState, useCallback, createContext } from "react";
import { Alert, Platform } from "react-native";
import { PERMISSIONS, request, requestMultiple } from "react-native-permissions";
import * as ExpoDevice from "expo-device";
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
} from "react-native-ble-plx";
import { SERVICE_UUID, CHARACTERISTIC_UUID, MESSAGE_TYPES } from "@/utils/ble_constants";

import { getConfigurations, getSpeakers, updateConnectionStatus, updateSpeakerConnectionStatus } from "@/utils/database";

type NotificationHandler = (error: BleError | null, characteristic: Characteristic | null) => void;

interface ConnectionStatus {
  status: string;
  progress?: number;
  error?: string;
  mac?: string;
}

interface BLEContextType {
  allDevices: Device[];
  connectedDevice: Device | null;
  isScanning: boolean;
  requestPermissions: () => Promise<boolean>;
  manager: BleManager;
  waitForPi: () => Promise<Device>;
  ensurePiNotifications: (dev: Device, onNotify: (e: BleError | null, c: Characteristic | null) => void) => void;
  handleNotification: NotificationHandler;
  connectionStatus: ConnectionStatus | null;
  setConnectionStatus: (status: ConnectionStatus | null) => void;
  clearConnectionStatus: () => void;
}

const BLEContext = createContext<BLEContextType | null>(null);

function updateDatabaseConnectionStates(connectedMacs: string[], onUpdate?: () => void) {
  console.log("[BLE] 🔄 Updating DB connection states...");
  console.log("[BLE] ✅ Connected MACs:", connectedMacs);

  const configs = getConfigurations();
  let didUpdate = false;

  for (const config of configs) {
    console.log(`[BLE] 📦 Checking config "${config.name}" (ID: ${config.id})`);
    const speakers = getSpeakers(config.id);
    let anySpeakerConnected = false;

    for (const speaker of speakers) {
      const mac = speaker.mac?.toUpperCase();
      const isNowConnected = connectedMacs.includes(mac);
      const wasConnected = speaker.is_connected === 1;

      console.log(`[BLE] 🔍 Speaker: ${speaker.name} [${mac}] → wasConnected=${wasConnected}, isNowConnected=${isNowConnected}`);

      if (wasConnected !== isNowConnected) {
        console.log(`[BLE] ✏️ Updating speaker "${speaker.name}" → is_connected=${isNowConnected ? 1 : 0}`);
        updateSpeakerConnectionStatus(config.id, mac, isNowConnected);
        didUpdate = true;
      }

      if (isNowConnected) anySpeakerConnected = true;
    }

    const configShouldBe = anySpeakerConnected ? 1 : 0;
    if (config.isConnected !== configShouldBe) {
      console.log(`[BLE] ⚙️ Updating config "${config.name}" → isConnected=${configShouldBe}`);
      updateConnectionStatus(config.id, configShouldBe);
      didUpdate = true;
    } else {
      console.log(`[BLE] ↪️ Config "${config.name}" already correct`);
    }
  }

  if (didUpdate) {
    console.log("[BLE] ✅ DB updated, triggering UI refresh");
    if (onUpdate) onUpdate();
  } else {
    console.log("[BLE] 🚫 No changes detected in DB");
  }
}

export function useBLE(onNotification?: NotificationHandler) {
  const [bleManager] = useState(() => new BleManager({
    restoreStateIdentifier: 'sync-sonic-ble',
    restoreStateFunction: (restoredState) => {
      console.log('BLE Manager state restored:', restoredState);
    }
  }));

  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [pendingDevices, setPendingDevices] = useState<Device[]>([]);
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [scannedDevices, setScannedDevices] = useState<Array<{ mac: string; name: string; paired?: boolean }>>([]);
  const [pairedDevices, setPairedDevices] = useState<Array<{ mac: string; name: string; paired?: boolean }>>([]);

  const clearConnectionStatus = useCallback(() => {
    setConnectionStatus(null);
  }, []);

  // Define handleNotification here so it has access to setConnectionStatus
  const handleNotification: NotificationHandler = (error, characteristic) => {
    if (error) {
      // Check if the error is a disconnection
      if (error.message?.includes('disconnected')) {
        Alert.alert(
          "Disconnected",
          "Phone connection was lost.",
          [{ text: "OK" }]
        );
      }
      return;
    }

    if (!characteristic?.value) {
      console.warn("[BLE] Empty notification received");
      return;
    }

    try {
      const rawBytes = atob(characteristic.value);

      if (rawBytes.length < 2) {
        console.warn("[BLE] Notification payload too short");
        return;
      }

      const opcode = rawBytes.charCodeAt(0);      // first byte
      const jsonString = rawBytes.slice(1);        // rest is JSON
      const payload = JSON.parse(jsonString);

      console.log("[BLE] Received notification:", { opcode, payload });

      switch (opcode) {
        case MESSAGE_TYPES.SUCCESS:
          if (payload.scanning !== undefined) {
            // ACK for SCAN_START/STOP – nothing to do
          } else if (payload.connected) {
            // List of currently connected speakers
            updateDatabaseConnectionStates(payload.connected);
          } else {
            // Assume this is the paired-device list coming from GET_PAIRED_DEVICES (0x64)
            const list: { mac: string; name: string; paired?: boolean }[] =
              Object.entries(payload).map(([mac, name]) => ({
                mac,
                name: name as string,
                paired: true,
              }));
            setPairedDevices(list);
          }
          break;

        case MESSAGE_TYPES.SCAN_DEVICES: {
            // payload.device === { mac, name, paired }
            const dev = payload.device as { mac: string; name: string; paired: boolean };
            setScannedDevices(old => {
              if (old.find(d => d.mac === dev.mac)) return old;
              return [...old, { mac: dev.mac, name: dev.name }];
            });
            break;
          }
        
        case MESSAGE_TYPES.CONNECTION_STATUS_UPDATE:
          // Handle connection status update
          if (payload.phase) {
            let statusMessage = "";
            let progress = undefined;
            let error = undefined;

            switch (payload.phase) {
              case "fsm_start":
                statusMessage = "Starting connection process...";
                break;
              case "fsm_state":
                statusMessage = `Connecting (${payload.state})...`;
                progress = (payload.attempt / 3) * 100;
                break;
              case "discovery_start":
                statusMessage = "Discovering speaker...";
                break;
              case "discovery_complete":
                statusMessage = "Speaker found!";
                break;
              case "pairing_start":
                statusMessage = "Pairing with speaker...";
                break;
              case "pairing_success":
                statusMessage = "Pairing successful!";
                break;
              case "trusting":
                statusMessage = "Establishing trust...";
                break;
              case "connect_start":
                statusMessage = "Connecting to speaker...";
                break;
              case "connect_success":
                statusMessage = "Connection successful!";
                break;
            }

            setConnectionStatus({
              status: statusMessage,
              progress: progress,
              error: error,
              mac: payload.device
            });
          }
          break;
        
        case MESSAGE_TYPES.ERROR:
          // Handle error messages
          if (payload.phase) {
            let errorMessage = "";
            
            switch (payload.phase) {
              case "discovery_timeout":
                errorMessage = "Could not find speaker. Please ensure it's in pairing mode.";
                break;
              case "pairing_failed":
                errorMessage = `Pairing failed (attempt ${payload.attempt}/3). Please try again.`;
                break;
              case "connect_failed":
                errorMessage = `Connection failed (attempt ${payload.attempt}/3). Please try again.`;
                break;
              case "loopback creation failed":
                errorMessage = "Connection successful but audio routing failed. Please try connecting again.";
                break;
              default:
                errorMessage = `Error: ${payload.phase}`;
            }

            setConnectionStatus({
              status: "Connection failed",
              error: errorMessage,
              mac: payload.device
            });
          }
          break;
        
        default:
          console.warn(`[BLE] Unexpected opcode: ${opcode}`);
      }

    } catch (err) {
      console.error("[BLE] Failed to decode notification:", err);
    }
  };

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
      // 1) fetch the services array
      const services = await deviceConnection.services()

      // 2) log out exactly what you got back
      console.log("Discovered services on Pi:", services.map(s => s.uuid))

      // now you can proceed to monitor/ write…
      if (!services.some(s => s.uuid === SERVICE_UUID)) {
        console.log("🛑 Our custom service UUID not found!")
}

      // Set up notification handler if provided
      if (onNotification) {
        await deviceConnection.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          (err, char) => {
            console.log('[BLE] monitor callback fired'); 
            console.log('[BLE] NOTIFY raw:', char?.value);
            handleNotification(err, char);   // <-- always handle it internally
            onNotification?.(err, char);     // <-- still call external handler if user passed one
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

  // inside useBLE (add just after stopScan)
const waitForPi = (): Promise<Device> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stopScan();
      reject(new Error("Scan timeout (15 s)"));
    }, 15_000);

    // narrow scan to our service UUID to reduce noise
    bleManager.startDeviceScan([SERVICE_UUID], null, (err, dev) => {
      if (err) {
        stopScan();
        clearTimeout(timer);
        return reject(err);
      }
      if (
        dev &&
        (dev.name?.toLowerCase() === "sync-sonic" ||
         dev.localName?.toLowerCase() === "sync-sonic")
      ) {
        stopScan();
        clearTimeout(timer);
        resolve(dev);
      }
    });
  });

  return {
    scanForPeripherals,
    stopScan,
    connectToDevice,
    allDevices,
    connectedDevice,
    isScanning,
    requestPermissions,
    manager: bleManager,
    waitForPi,
    ensurePiNotifications,      
    handleNotification,
    connectionStatus,
    setConnectionStatus,
    clearConnectionStatus,
    scannedDevices,
    pairedDevices,
  };
}

export default useBLE;