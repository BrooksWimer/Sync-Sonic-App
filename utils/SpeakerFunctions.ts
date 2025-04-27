import { Alert } from "react-native";
import { KNOWN_CONTROLLERS } from "./constants";
import { PI_API_URL } from '../utils/constants';
import { addConfiguration, addSpeaker, deleteConfiguration, updateConfiguration, updateSpeakerConnectionStatus, updateConnectionStatus } from "@/app/database";
import { setLatency, setVolume } from './ble_functions';
import { Device } from 'react-native-ble-plx';

type SpeakerSettings = { [mac: string]: { volume: number; latency: number; isConnected: boolean } };

export const adjustVolume = async (mac: string, volume: number): Promise<void> => {
  try {
    const response = await fetch(`${PI_API_URL}/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, volume })
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  } catch (error) {
    console.error(`Error setting volume for ${mac}:`, error);
    Alert.alert("Volume Error", `Failed to set volume for speaker ${mac}`);
  }
};

export const adjustLatency = async (mac: string, latency: number): Promise<void> => {
  try {
    const response = await fetch(`${PI_API_URL}/latency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, latency })
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  } catch (error) {
    console.error(`Error setting latency for ${mac}:`, error);
    Alert.alert("Latency Error", `Failed to set latency for speaker ${mac}`);
  }
};

export const handleVolumeChange = async (
  mac: string,
  newVolume: number,
  settings: SpeakerSettings,
  setSettings: (settings: SpeakerSettings) => void,
  configIDParam: string | null,
  updateSpeakerSettings: (configID: number, mac: string, volume: number, latency: number) => void,
  connectedDevice: Device | null,
  isSlidingComplete: boolean = false
): Promise<void> => {
  // Always update local state for smooth UI
  const newSettings: SpeakerSettings = {
    ...settings,
    [mac]: { ...settings[mac], volume: newVolume }
  };
  setSettings(newSettings);

  // Only update backend and database when sliding is complete
  if (isSlidingComplete) {
    if (connectedDevice) {
      await setVolume(connectedDevice, mac, newVolume);
    } else {
      console.error('No BLE device connected for volume change');
      Alert.alert("Volume Error", "No BLE device connected");
    }
    
    if (configIDParam) {
      updateSpeakerSettings(Number(configIDParam), mac, newVolume, settings[mac]?.latency || 100);
    }
  }
};

export const handleLatencyChange = async (
  mac: string,
  newLatency: number,
  settings: SpeakerSettings,
  setSettings: (settings: SpeakerSettings) => void,
  configIDParam: string | null,
  updateSpeakerSettings: (configID: number, mac: string, volume: number, latency: number) => void,
  isSlidingComplete: boolean = false,
  connectedDevice: Device | null
): Promise<void> => {
  console.log('handleLatencyChange called with:', {
    mac,
    newLatency,
    isSlidingComplete,
    hasConnectedDevice: !!connectedDevice,
    deviceId: connectedDevice?.id
  });

  // Always update local state for smooth UI
  const newSettings: SpeakerSettings = {
    ...settings,
    [mac]: { ...settings[mac], latency: newLatency }
  };
  setSettings(newSettings);

  // Only update backend and database when sliding is complete
  if (isSlidingComplete) {
    try {
      if (!connectedDevice) {
        console.log('No BLE device connected');
        throw new Error('No BLE device connected');
      }
      console.log('Attempting to set latency via BLE:', {
        deviceId: connectedDevice.id,
        mac,
        newLatency
      });
      
      await setLatency(connectedDevice, mac, newLatency);
      console.log('Successfully set latency via BLE');
      
      if (configIDParam) {
        console.log('Updating database with new latency');
        updateSpeakerSettings(Number(configIDParam), mac, settings[mac]?.volume || 50, newLatency);
      }
    } catch (error) {
      console.error('Error setting latency:', error);
      Alert.alert('Latency Error', `Failed to set latency for speaker ${mac}`);
    }
  }
};


