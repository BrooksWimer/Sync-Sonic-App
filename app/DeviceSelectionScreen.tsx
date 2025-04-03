import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSearchParams } from 'expo-router/build/hooks';
import { 
  addConfiguration, 
  updateConnectionStatus,
  updateSpeakerConnectionStatus,
  addSpeaker, 
  getSpeakers
} from './database';

// const PI_API_URL = 'http://10.193.147.160:3000'; // Your Pi's API URL
const PI_API_URL = "http://10.0.0.89:3000"

let scanInterval: NodeJS.Timeout | null = null;

// Define the expected type for devices
interface Device {
  mac: string;
  name: string;
}

export default function DeviceSelectionScreen() {
  const params = useSearchParams();
  const configName = params.get('configName') || 'Unnamed Configuration';
  const configIDParam = params.get('configID'); // might be undefined if new

  // Get existing devices (object mapping mac -> name) if provided
  const existingDevicesParam = params.get('existingDevices') || "{}";
  let parsedExistingDevices = {};
  try {
    parsedExistingDevices = JSON.parse(existingDevicesParam);
  } catch (e) {
    console.error("Error parsing existingDevices:", e);
  }
  
  // Store selected devices as an object keyed by MAC to guarantee uniqueness.
  const [devices, setDevices] = useState<{ mac: string, name: string }[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<{ [mac: string]: { mac: string, name: string } }>(parsedExistingDevices);
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<{ [mac: string]: string }>({}); // State for paired devices
  const [selectedPairedDevices, setSelectedPairedDevices] = useState<{ [mac: string]: { mac: string, name: string } }>({});
  const router = useRouter();

  // Start scanning and set up polling for device queue
  useEffect(() => {
    const initializeScanning = async () => {
      try {
        // Fetch paired devices first
        await fetchPairedDevices(); 
        
        // Start scanning
        await fetch(`${PI_API_URL}/start-scan`);
        console.log("Started scanning");

        // Start polling device queue
        scanInterval = setInterval(fetchDeviceQueue, 1000);
      } catch (err) {
        console.error("Failed to initialize scanning:", err);
      }
    };
  
    initializeScanning();
  
    return () => {
      if (scanInterval) clearInterval(scanInterval);
    };
  }, []);
  

  // Poll the device queue
  const fetchDeviceQueue = async () => {
    try {
      const response = await fetch(`${PI_API_URL}/device-queue`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data: Record<string, unknown> = await response.json(); // Use Record<string, unknown> for the response

      // Use type assertion to ensure correct types
      const deviceArray: Device[] = Object.entries(data).map(([mac, name]) => ({
        mac,
        name: name as string, // Assert name as string
      }));
      setDevices(deviceArray);
    } catch (err) {
      console.error("Error fetching device queue:", err);
    }
  };

  // Fetch paired devices from the API
  const fetchPairedDevices = async () => {
    try {
      const response = await fetch(`${PI_API_URL}/paired-devices`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const pairedDevicesData = await response.json();
      setPairedDevices(pairedDevicesData);
    } catch (error) {
      console.error('Error fetching paired devices:', error);
      Alert.alert('Error', 'Could not fetch paired devices.');
    }
  };

  // Toggle selection of a paired device using its MAC as unique key.
  const togglePairedSelection = (device: { mac: string; name: string }) => {
    setSelectedPairedDevices(prev => {
      const newSelection = { ...prev };
      if (newSelection[device.mac]) {
        delete newSelection[device.mac];
      } else {
        // Allow a maximum of three devices.
        if (Object.keys(newSelection).length >= 3) {
          Alert.alert('Selection Limit', 'You can select up to 3 devices.');
          return prev;
        }
        newSelection[device.mac] = device;
      }
      return newSelection;
    });
  };

  // Toggle selection of a device using its MAC as unique key.
  const toggleSelection = (device: { mac: string; name: string }) => {
    setSelectedDevices(prev => {
      const newSelection = { ...prev };
      if (newSelection[device.mac]) {
        delete newSelection[device.mac];
      } else {
        // Allow a maximum of three devices.
        if (Object.keys(newSelection).length >= 3) {
          Alert.alert('Selection Limit', 'You can select up to 3 devices.');
          return prev;
        }
        newSelection[device.mac] = device;
      }
      return newSelection;
    });
  };

  // Render each device as a clickable item.
  const renderItem = ({ item }: { item: { mac: string, name: string } }) => {
    const isSelected = selectedDevices[item.mac] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item)}
        style={[
          styles.deviceItem,
          isSelected && styles.selectedDevice
        ]}
      >
        <Text style={styles.deviceName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // Render paired devices with selection capability
  const renderPairedDevice = ({ item }: { item: { mac: string, name: string } }) => {
    const isSelected = selectedPairedDevices[item.mac] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => togglePairedSelection(item)}
        style={[
          styles.deviceItem,
          isSelected && styles.selectedDevice
        ]}
      >
        <Text style={styles.deviceName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // Pair the selected devices by sending them to the Pi's /pair endpoint.
  const pairSelectedDevices = async () => {
    const allSelectedDevices = { ...selectedDevices, ...selectedPairedDevices };
    if (Object.keys(allSelectedDevices).length === 0) {
      Alert.alert('No Devices Selected', 'Please select at least one device to pair.');
      return;
    }
    setPairing(true);
    if (scanInterval) clearInterval(scanInterval); // Stop polling when pairing starts
    try {
      // Stop the scan on the server
      await fetch(`${PI_API_URL}/stop-scan`);
      // Build payload from the selectedDevices object.
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
        // Edit mode: update DB and navigate back to the edit configuration page.
        updateConnectionStatus(configIDParsed, 1);
      
        // Retrieve current speakers from the database for this configuration.
        const currentSpeakers = getSpeakers(configIDParsed);
        // Extract an array of MAC addresses from the current speakers.
        const existingMacs = currentSpeakers.map(speaker => speaker.mac);
      
        // Loop over the payload devices and add only unique speakers.
        Object.entries(payload.devices).forEach(([mac, name]) => {
          if (!existingMacs.includes(mac)) {
            addSpeaker(configIDParsed, name, mac);
            // Set initial connection status for new speakers
            updateSpeakerConnectionStatus(configIDParsed, mac, true);
          } else {
            // Update connection status for existing speakers
            updateSpeakerConnectionStatus(configIDParsed, mac, true);
          }
        });

        // Update connection status to false for speakers that were removed
        currentSpeakers.forEach(speaker => {
          if (!Object.keys(payload.devices).includes(speaker.mac)) {
            updateSpeakerConnectionStatus(configIDParsed, speaker.mac, false);
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
        // New configuration: create it, add speakers, update connection, then navigate.
        addConfiguration(configName, (newConfigID: number) => {
          Object.entries(payload.devices).forEach(([mac, name]) => {
            addSpeaker(newConfigID, name, mac);
            // Set initial connection status for all speakers
            updateSpeakerConnectionStatus(newConfigID, mac, true);
          });
          updateConnectionStatus(newConfigID, 1);
          router.push({
            pathname: '/SpeakerConfigScreen',
            params: { 
              speakers: JSON.stringify(payload.devices), 
              configName: configName,
              configID: newConfigID.toString()
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Select Speakers</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#FF0055" />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.mac}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No devices found.</Text>}
          style={styles.list}
        />
      )}
      <Text style={styles.header}>Paired Devices</Text>
      <FlatList
        data={Object.entries(pairedDevices).map(([mac, name]) => ({ mac, name }))}
        keyExtractor={(item) => item.mac}
        renderItem={renderPairedDevice}
        ListEmptyComponent={<Text style={styles.emptyText}>No paired devices found.</Text>}
        style={styles.list}
      />
      <TouchableOpacity
        onPress={pairSelectedDevices}
        style={[styles.pairButton, pairing && styles.disabledButton]}
      >
        {pairing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.pairButtonText}>Pair Selected Devices</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#F2E8FF' 
  },
  header: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    marginTop: 20,
    textAlign: 'center',
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  list: {
    marginBottom: 20
  },
  deviceItem: {
    padding: 16,
    backgroundColor: '#9D9D9D',
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  selectedDevice: {
    backgroundColor: '#3E0094',
  },
  deviceName: { 
    fontSize: 18,
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  emptyText: {
    fontSize: 16,
    color: '#26004E',
    textAlign: 'center',
    fontFamily: "Finlandica"
  },
  pairButton: {
    backgroundColor: '#3E0094',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  pairButtonText: { 
    color: '#F2E8FF', 
    fontSize: 18,
    fontFamily: "Finlandica"
  },
  disabledButton: {
    opacity: 0.7,
  },
});
