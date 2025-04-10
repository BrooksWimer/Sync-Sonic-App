import { Alert } from "react-native";
import { KNOWN_CONTROLLERS } from "./constants";
import { PI_API_URL } from '../utils/constants';
import { addConfiguration, addSpeaker, deleteConfiguration, updateConfiguration, updateSpeakerConnectionStatus, updateConnectionStatus, deleteSpeakerById, logDatabaseContents } from "@/app/database";

export const checkBluetoothPorts = async (): Promise<{ freeController: string | null, error: string | null }> => {
    try {
      const response = await fetch(`${PI_API_URL}/bluetooth-ports`);
      const data = await response.json();
      // data is expected to be an object with keys like "MAC (controller label)" mapped to an array of devices.
      const usedControllers = new Set<string>();
      Object.keys(data).forEach(key => {
        // Extract the MAC address from key, assuming key is "MAC (controller label)".
        const mac = key.split(" ")[0];
        if (data[key] && data[key].length > 0) {
          usedControllers.add(mac);
        }
      });
      let free: string | null = null;
      for (const mac in KNOWN_CONTROLLERS) {
        if (!usedControllers.has(mac)) {
          free = KNOWN_CONTROLLERS[mac];
          break;
        }
      }
      return { freeController: free, error: null };
    } catch (error) {
      console.error("Error checking bluetooth ports:", error);
      return { freeController: null, error: "Failed to check bluetooth ports." };
    }
  };

// Function to check if all speakers are connected
export const areAllSpeakersConnected = (connectedSpeakers: { [mac: string]: any }, settings: { [mac: string]: { isConnected: boolean } }) => {
        return Object.keys(connectedSpeakers).every(mac => settings[mac]?.isConnected);
    };

// function to handle deleting configuration in SpeakerConfigScreen
export const handleDelete = async (configIDParam: string | null, router: any): Promise<void> => {
        try {
          if (configIDParam) {
            deleteConfiguration(Number(configIDParam));
          }
          router.replace('/home');
        } catch (error) {
          console.error("Error deleting configuration:", error);
          Alert.alert("Delete Error", "Failed to delete configuration.");
        }
      };

// function to handle saving configuration in DeviceSelectionScreen
export const handleSave = async (
        configIDParam: string | null,
        configNameParam: string,
        connectedSpeakers: { [mac: string]: string },
        setIsSaving: (isSaving: boolean) => void
      ): Promise<void> => {
        setIsSaving(true);
        const speakersArray = Object.entries(connectedSpeakers).map(([mac, name]) => ({ mac, name }));
        
        try {
          if (configIDParam) {
            updateConfiguration(Number(configIDParam), configNameParam);
            speakersArray.forEach(({ mac, name }) => {
              addSpeaker(Number(configIDParam), name, mac);
            });
            Alert.alert('Saved', 'Configuration updated successfully.');
          } else {
            addConfiguration(configNameParam, (newConfigID: number) => {
              speakersArray.forEach(({ mac, name }) => {
                addSpeaker(newConfigID, name, mac);
              });
              Alert.alert('Saved', 'Configuration saved successfully.');
            });
          }
        } catch (error) {
          console.error("Error saving configuration:", error);
          Alert.alert("Save Error", "Failed to save configuration.");
        } finally {
          setIsSaving(false);
        }
      };


// function to handle disconnecting configuration in SpeakerConfigScreen
export const handleDisconnect = async (
  configIDParam: string | null,
  configNameParam: string,
  connectedSpeakers: { [mac: string]: string },
  settings: { [mac: string]: { volume: number; latency: number; isConnected: boolean } },
  setSettings: (settings: { [mac: string]: { volume: number; latency: number; isConnected: boolean } }) => void,
  setIsConnected: (isConnected: boolean) => void,
  setIsDisconnecting: (isDisconnecting: boolean) => void
): Promise<void> => {
  setIsDisconnecting(true);
  const payload = {
    configID: configIDParam,
    configName: configNameParam,
    speakers: connectedSpeakers,
    settings: settings
  };

  try {
    const response = await fetch(`${PI_API_URL}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const result = await response.json();
    Alert.alert("Disconnected", "Configuration disconnected successfully.");
    
    // Update isConnected status for all speakers, both in the DB and in local state.
    const updatedSettings = { ...settings };
    Object.keys(updatedSettings).forEach(mac => {
      // Update local state
      updatedSettings[mac].isConnected = false;
      // Update the DB
      if (configIDParam) {
        updateSpeakerConnectionStatus(Number(configIDParam), mac, false);
      }
    });

    setSettings(updatedSettings);

    // Update overall configuration status to 0 (not connected).
    if (configIDParam) {
      updateConnectionStatus(Number(configIDParam), 0);
    }
    setIsConnected(false);

  } catch (error) {
    console.error("Error disconnecting configuration:", error);
    Alert.alert("Disconnection Error", "Failed to disconnect configuration.");
  } finally {
    setIsDisconnecting(false);
  }
};

export const handleConnect = async (
  configIDParam: string | null,
  configNameParam: string,
  connectedSpeakers: { [mac: string]: string },
  settings: { [mac: string]: { volume: number; latency: number; isConnected: boolean } },
  setSettings: (settings: { [mac: string]: { volume: number; latency: number; isConnected: boolean } }) => void,
  setIsConnected: (isConnected: boolean) => void,
  setIsConnecting: (isConnecting: boolean) => void
): Promise<void> => {
  if (areAllSpeakersConnected(connectedSpeakers, settings)) {
    Alert.alert("Already Connected", "All speakers are already connected.");
    return;
  }

  setIsConnecting(true);
  const payload = {
    configID: configIDParam,
    configName: configNameParam,
    speakers: connectedSpeakers,
    settings: settings
  };

  try {
    const response = await fetch(`${PI_API_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const result = await response.json();
  
    const configIdNum = configIDParam ? Number(configIDParam) : 0;
    let anyConnected = false;
    const updatedSettings = { ...settings };
    
    // Create a message showing the status of each speaker
    let statusMessage = "Connection Status:\n\n";
    
    Object.keys(result).forEach(mac => {
      const isConnected = result[mac].result === "Connected";
      const speakerName = connectedSpeakers[mac] || result[mac].name || mac;
      const status = isConnected ? "✅ Connected" : "❌ Not Connected";
      
      statusMessage += `${speakerName}: ${status}\n`;
      
      // Update per-speaker status in the database.
      updateSpeakerConnectionStatus(configIdNum, mac, isConnected);
      // Update local settings for that speaker.
      if (updatedSettings[mac]) {
        updatedSettings[mac].isConnected = isConnected;
      }
      if (isConnected) {
        anyConnected = true;
      }
    });
  
    // Update overall configuration status: connected if ANY speaker is connected.
    updateConnectionStatus(configIdNum, anyConnected ? 1 : 0);
    setSettings(updatedSettings);
    setIsConnected(anyConnected);
  
    Alert.alert("Connection Status", statusMessage);
  } catch (error) {
    console.error("Error connecting configuration:", error);
    Alert.alert("Connection Error", "Failed to connect configuration.");
  } finally {
    setIsConnecting(false);
  }
};

export const removeDevice = async (
    device: { id: number, name: string, mac: string },
    configID: number,
    configName: string,
    currentDevices: { id: number, name: string, mac: string }[],
    setDevices: (devices: { id: number, name: string, mac: string }[]) => void
) => {
    console.log("Removing device " + device.id);
    // If editing an existing configuration, update the DB immediately.
    if (configID) {
        deleteSpeakerById(device.id);
    }
    // Build payload to disconnect only this speaker.
    const payload = {
        configID: configID,
        configName: configName,
        speakers: { [device.mac]: device.name },
        settings: {} // Assuming no settings needed for disconnecting a single speaker.
    };
    try {
        const response = await fetch(PI_API_URL+"/disconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const result = await response.json();
        console.log("Disconnect result:", result);
    } catch (error) {
        console.error("Error disconnecting device:", error);
        Alert.alert("Error", "There was an error disconnecting the device.");
    }
    // Update the local state to remove the device.
    setDevices(currentDevices.filter(d => d.id !== device.id));
};

export const saveChanges = (
    configID: number,
    configName: string,
    devices: { id: number, name: string, mac: string }[],
    router: any
) => {
    if (!configName.trim() || devices.length === 0) return; // don't save without name or devices
    if (configID) {
        // In edit mode, configuration updates happen immediately on deletion.
        console.log("Updating configuration name: " + configName);
        updateConfiguration(configID, configName);
    } else {
        // Create new configuration
        addConfiguration(configName, (newConfigID) => {
            devices.forEach(device => addSpeaker(newConfigID, device.name, device.mac));
            devices.forEach(device => updateSpeakerConnectionStatus(newConfigID, device.mac, true))
            console.log("New config: " + configName + ":" + newConfigID);
        });
    }
    logDatabaseContents();
    router.replace({
        pathname: "/SpeakerConfigScreen",
        params: { configID: configID.toString(), configName }
    }); // navigate to configuration screen
};

export const handleDeleteConfig = (
    id: number,
    setConfigurations: (updater: (prev: { id: number, name: string, speakerCount: number, isConnected: number }[]) => { id: number, name: string, speakerCount: number, isConnected: number }[]) => void
) => {
    Alert.alert(
        'Delete Configuration',
        'Are you sure you want to delete this configuration?',
        [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    deleteConfiguration(id)
                    setConfigurations(prev => prev.filter(c => c.id !== id))
                }
            }
        ]
    )
};

// Handler to check which controller is free by calling the bluetooth-ports endpoint.
// export const handleCheckPort = async () => {
//     setIsCheckingPort(true);
//     const { freeController, error } = await checkBluetoothPorts();
//     setFreeController(freeController);
//     if (freeController) {
//       Alert.alert("Connect Phone", `Connect phone to ${freeController}`);
//     } else {
//       Alert.alert("Connect Phone", "All ports are connected to speakers.");
//     }
//     if (error) {
//       Alert.alert("Error", error);
//     }
//     setIsCheckingPort(false);
//   };
