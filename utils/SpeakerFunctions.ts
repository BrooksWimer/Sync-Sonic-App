import { Alert } from "react-native";
import { KNOWN_CONTROLLERS } from "./constants";
import { PI_API_URL } from '../utils/constants';
import { addConfiguration, addSpeaker, deleteConfiguration, updateConfiguration, updateSpeakerConnectionStatus, updateConnectionStatus } from "@/app/database";

type SpeakerSettings = { [mac: string]: { volume: number; latency: number; isConnected: boolean; balance: number; isMuted: boolean } };

export const adjustVolume = async (mac: string, volume: number, balance: number): Promise<void> => {
  try {
    const response = await fetch(`${PI_API_URL}/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, volume, balance })
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
  updateSpeakerSettings: (configID: number, mac: string, volume: number, latency: number, balance: number) => void,
  isSlidingComplete: boolean = false
): Promise<void> => {
  // Update local state immediately
  const newSettings: SpeakerSettings = {
    ...settings,
    [mac]: { ...settings[mac], volume: newVolume }
  };
  setSettings(newSettings);

  // If still sliding, don't do server/database updates
  if (!isSlidingComplete) {
    return;
  }

  try {
    // Update database first
    if (configIDParam) {
      updateSpeakerSettings(
        Number(configIDParam),
        mac,
        newVolume,
        settings[mac]?.latency || 100,
        settings[mac]?.balance || 0.5
      );
    }

    // Then update server
    await adjustVolume(mac, newVolume, settings[mac]?.balance || 0.5);
  } catch (error) {
    console.error("Error updating volume:", error);
    Alert.alert("Error", "Failed to update volume settings.");
  }
};

export const handleLatencyChange = async (
  mac: string,
  newLatency: number,
  settings: SpeakerSettings,
  setSettings: (settings: SpeakerSettings) => void,
  configIDParam: string | null,
  updateSpeakerSettings: (configID: number, mac: string, volume: number, latency: number, balance: number) => void,
  isSlidingComplete: boolean = false
): Promise<void> => {
  // Only update local state during sliding
  if (!isSlidingComplete) {
    const newSettings: SpeakerSettings = {
      ...settings,
      [mac]: { ...settings[mac], latency: newLatency }
    };
    setSettings(newSettings);
    return;
  }

  // When sliding is complete, try to update server and database
  try {
    await adjustLatency(mac, newLatency);
    if (configIDParam) {
      updateSpeakerSettings(
        Number(configIDParam),
        mac,
        settings[mac]?.volume || 50,
        newLatency,
        settings[mac]?.balance || 0.5
      );
    }
    // Only update local state if server/database update succeeds
    const newSettings: SpeakerSettings = {
      ...settings,
      [mac]: { ...settings[mac], latency: newLatency }
    };
    setSettings(newSettings);
  } catch (error) {
    console.error("Error updating latency:", error);
    Alert.alert("Error", "Failed to update latency settings.");
    // Revert to previous value on error
    const newSettings: SpeakerSettings = {
      ...settings,
      [mac]: { ...settings[mac], latency: settings[mac]?.latency || 100 }
    };
    setSettings(newSettings);
  }
};