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
import { Button, H1, useTheme, useThemeName, YStack } from 'tamagui';
import { TopBar } from '@/components/TopBar';
import { AlignCenter } from '@tamagui/lucide-icons';
import {PI_API_URL} from '../utils/consts'


let scanInterval: NodeJS.Timeout | null = null;

// Define the expected type for devices
interface Device {
  mac: string;
  name: string;
}

const testerDev: Device = {
  mac: "test-mac",
  name: "tester speaker"
};

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
      deviceArray.concat([testerDev]);
      const newArray = deviceArray.concat([testerDev]);
      console.log("fire")
      const now = new Date();
      console.log(now.toTimeString() + ", found devices: " + deviceArray);
      
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
        //updateConnectionStatus(configIDParsed, 1);
      
        // Retrieve current speakers from the database for this configuration.
        const currentSpeakers = getSpeakers(configIDParsed);
        // Extract an array of MAC addresses from the current speakers.
        const existingMacs = currentSpeakers.map(speaker => speaker.mac);
      
        // Loop over the payload devices and add only unique speakers.
        Object.entries(payload.devices).forEach(([mac, name]) => {
          if (!existingMacs.includes(mac)) {
            addSpeaker(configIDParsed, name, mac);
            // Set initial connection status for new speakers
            //updateSpeakerConnectionStatus(configIDParsed, mac, true);
          } else {
            // Update connection status for existing speakers
            //updateSpeakerConnectionStatus(configIDParsed, mac, true);
          }
        });

        // Update connection status to false for speakers that were removed
        currentSpeakers.forEach(speaker => {
          if (!Object.keys(payload.devices).includes(speaker.mac)) {
            //updateSpeakerConnectionStatus(configIDParsed, speaker.mac, false);
          }
        });
        setDevices([]);

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
            //updateSpeakerConnectionStatus(newConfigID, mac, true);
          });
          //updateConnectionStatus(newConfigID, 1);
          router.push({
            pathname: '/settings/config',
          params: { 
            configID: newConfigID, 
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

  const themeName = useThemeName();
  const theme = useTheme();
  
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'

  return (
     <YStack flex={1} backgroundColor={bg}>
            {/* Top Bar with Back Button */}
            <TopBar/>

            {/* Header */}
            <View style={{
                paddingTop: 20,
                paddingBottom: 10,
                alignItems: "center",
            }}>
                <H1 style={{ fontSize: 32, fontWeight: "bold", color: tc }}>Select Speaker</H1>
            </View>
      {loading ? (
        <ActivityIndicator size="large" color="#FF0055" />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.mac}
          renderItem={renderItem}
          ListEmptyComponent={<H1
            style={{ color: tc }}
            alignSelf='center'
            fontFamily="Finlandica"
            fontSize={15}
            lineHeight={44}
            fontWeight="400">
            No devices found
  </H1>}
          style={styles.list}
        />
      )}
      {/* Header */}
      <View style={{
                paddingTop: 20,
                paddingBottom: 10,
                alignItems: "center",
            }}>
                <H1 style={{ fontSize: 32, fontWeight: "bold", color: tc }}>Saved Speakers</H1>
            </View>
      <FlatList
        data={Object.entries(pairedDevices).map(([mac, name]) => ({ mac, name }))}
        keyExtractor={(item) => item.mac}
        renderItem={renderPairedDevice}
        ListEmptyComponent={<H1
          style={{ color: tc }}
          alignSelf='center'
          fontFamily="Finlandica"
          fontSize={15}
          lineHeight={44}
          fontWeight="400">
          No paired devices found
</H1>}
        style={styles.list}
      />
      <Button
        onPress={pairSelectedDevices}
        style={{
          
          backgroundColor: pc,
          width: '90%',
          height: 50,
          borderRadius: 999,
          marginBottom: 10,
          alignSelf: 'center',
        }}
      >
        {pairing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <H1 color="white" fontSize={18} alignSelf='center'>
          Pair selected devices
        </H1>
        )}
      </Button>
    </YStack>
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