import { Alert } from "react-native";
import { KNOWN_CONTROLLERS } from "./constants";
import { PI_API_URL } from '../utils/constants';
import { addConfiguration, addSpeaker, deleteConfiguration, updateConfiguration, updateSpeakerConnectionStatus, updateConnectionStatus } from "@/app/database";

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
    await adjustVolume(mac, newVolume);
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
  isSlidingComplete: boolean = false
): Promise<void> => {
  // Always update local state for smooth UI
  const newSettings: SpeakerSettings = {
    ...settings,
    [mac]: { ...settings[mac], latency: newLatency }
  };
  setSettings(newSettings);

  // Only update backend and database when sliding is complete
  if (isSlidingComplete) {
    await adjustLatency(mac, newLatency);
    if (configIDParam) {
      updateSpeakerSettings(Number(configIDParam), mac, settings[mac]?.volume || 50, newLatency);
    }
  }
};


