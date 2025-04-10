import { Alert } from 'react-native';
import { PI_API_URL } from './constants';

export interface Device {
  mac: string;
  name: string;
}

// Poll the device queue
export const fetchDeviceQueue = async (): Promise<Device[]> => {
  try {
    const response = await fetch(`${PI_API_URL}/device-queue`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data: Record<string, unknown> = await response.json();

    // Use type assertion to ensure correct types
    const deviceArray: Device[] = Object.entries(data).map(([mac, name]) => ({
      mac,
      name: name as string,
    }));

    console.log("fire");
    const now = new Date();
    console.log(now.toTimeString() + ", found devices: " + deviceArray);
    
    return deviceArray;
  } catch (err) {
    console.error("Error fetching device queue:", err);
    return [];
  }
};

// Fetch paired devices from the API
export const fetchPairedDevices = async (): Promise<Record<string, string>> => {
  try {
    const response = await fetch(`${PI_API_URL}/paired-devices`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const pairedDevicesData = await response.json();
    return pairedDevicesData;
  } catch (error) {
    console.error('Error fetching paired devices:', error);
    Alert.alert('Error', 'Could not fetch paired devices.');
    return {};
  }
};

// Toggle selection of a paired device using its MAC as unique key
export const togglePairedSelection = (
  device: Device,
  currentSelection: Record<string, Device>,
  setSelection: (callback: (prev: Record<string, Device>) => Record<string, Device>) => void
) => {
  setSelection(prev => {
    const newSelection = { ...prev };
    if (newSelection[device.mac]) {
      delete newSelection[device.mac];
    } else {
      // Allow a maximum of three devices
      if (Object.keys(newSelection).length >= 3) {
        Alert.alert('Selection Limit', 'You can select up to 3 devices.');
        return prev;
      }
      newSelection[device.mac] = device;
    }
    return newSelection;
  });
};

// Toggle selection of a device using its MAC as unique key
export const toggleSelection = (
  device: Device,
  currentSelection: Record<string, Device>,
  setSelection: (callback: (prev: Record<string, Device>) => Record<string, Device>) => void
) => {
  setSelection(prev => {
    const newSelection = { ...prev };
    if (newSelection[device.mac]) {
      delete newSelection[device.mac];
    } else {
      // Allow a maximum of three devices
      if (Object.keys(newSelection).length >= 3) {
        Alert.alert('Selection Limit', 'You can select up to 3 devices.');
        return prev;
      }
      newSelection[device.mac] = device;
    }
    return newSelection;
  });
};

// Pair the selected devices by sending them to the Pi's /pair endpoint
export const pairSelectedDevices = async (
  selectedDevices: Record<string, Device>,
  selectedPairedDevices: Record<string, Device>,
  setPairing: (isPairing: boolean) => void,
  configIDParam: string | null,
  configName: string,
  updateConnectionStatus: (id: number, status: number) => void,
  getSpeakers: (id: number) => Device[],
  addSpeaker: (configId: number, name: string, mac: string) => void,
  updateSpeakerConnectionStatus: (configId: number, mac: string, isConnected: boolean) => void,
  addConfiguration: (name: string, callback: (id: number) => void) => void,
  router: any
): Promise<void> => {
  const allSelectedDevices = { ...selectedDevices, ...selectedPairedDevices };
  if (Object.keys(allSelectedDevices).length === 0) {
    Alert.alert('No Devices Selected', 'Please select at least one device to pair.');
    return;
  }
  setPairing(true);
  try {
    // Stop the scan on the server
    await fetch(`${PI_API_URL}/stop-scan`);
    // Build payload from the selectedDevices object
    const payload = {
      devices: Object.values(allSelectedDevices).reduce((acc, device) => {
        acc[device.mac] = device.name;
        return acc;
      }, {} as { [mac: string]: string })
    };

    const response = await fetch(`${PI_API_URL}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const result = await response.json();
    console.log('Pairing result:', result);
    Alert.alert('Pairing Complete', 'Devices have been paired.');

    // Convert configIDParam to a number
    const configIDParsed = Number(configIDParam);
    if (!isNaN(configIDParsed) && configIDParsed > 0) {
      // Edit mode: update DB and navigate back to the edit configuration page
      updateConnectionStatus(configIDParsed, 1);
    
      // Retrieve current speakers from the database for this configuration
      const currentSpeakers = getSpeakers(configIDParsed);
      // Extract an array of MAC addresses from the current speakers
      const existingMacs = currentSpeakers.map(speaker => speaker.mac);
    
      // Loop over the payload devices and add only unique speakers
      Object.entries(payload.devices).forEach(([mac, name]) => {
        if (!existingMacs.includes(mac)) {
          addSpeaker(configIDParsed, name, mac);
          // Set initial connection status for new speakers based on the result
          const isConnected = result[mac]?.result === "Connected";
          updateSpeakerConnectionStatus(configIDParsed, mac, isConnected);
        } else {
          // Update connection status for existing speakers based on the result
          const isConnected = result[mac]?.result === "Connected";
          updateSpeakerConnectionStatus(configIDParsed, mac, isConnected);
        }
      });

      router.push({
        pathname: '/settings/config',
        params: { 
          configID: configIDParsed.toString(), 
          configName: configName
        }
      });
    } else {
      // New configuration: create it, add speakers, update connection, then navigate
      addConfiguration(configName, (newConfigID: number) => {
        Object.entries(payload.devices).forEach(([mac, name]) => {
          addSpeaker(newConfigID, name, mac);
          // Set initial connection status for all speakers
          const isConnected = result[mac]?.result === "Connected";
          updateSpeakerConnectionStatus(newConfigID, mac, isConnected);
        });
        updateConnectionStatus(newConfigID, 1);
        router.push({
          pathname: '/settings/config',
          params: { 
            configID: newConfigID.toString(), 
            configName: configName
          }
        });
      });
    }
  } catch (error) {
    console.error('Error during pairing:', error);
    Alert.alert('Pairing Error', 'There was an error pairing the devices.');
  } finally {
    setPairing(false);
  }
};
