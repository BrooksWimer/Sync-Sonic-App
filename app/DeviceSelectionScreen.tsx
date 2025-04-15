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
import { PI_API_URL } from '../utils/constants';
import { 
  Device,
  fetchDeviceQueue,
  fetchPairedDevices,
  togglePairedSelection,
  toggleSelection,
  pairSelectedDevices
} from '../utils/PairingFunctions';

const testerDev: Device = {
  mac: "test-mac",
  name: "tester speaker"
};

export default function DeviceSelectionScreen() {
  const params = useSearchParams();
  const configName = params.get('configName') || 'Unnamed Configuration';
  const configIDParam = params.get('configID'); // might be undefined if new
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);

  // Get existing devices (object mapping mac -> name) if provided
  const existingDevicesParam = params.get('existingDevices') || "{}";
  let parsedExistingDevices = {};
  try {
    parsedExistingDevices = JSON.parse(existingDevicesParam);
  } catch (e) {
    console.error("Error parsing existingDevices:", e);
  }
  
  // Store selected devices as an object keyed by MAC to guarantee uniqueness.
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Record<string, Device>>(parsedExistingDevices);
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<Record<string, string>>({}); // State for paired devices
  const [selectedPairedDevices, setSelectedPairedDevices] = useState<Record<string, Device>>({});
  const router = useRouter();

  // Start scanning and set up polling for device queue
  useEffect(() => {
    const initializeScanning = async () => {
      try {
        // Fetch paired devices first
        const pairedDevicesData = await fetchPairedDevices();
        setPairedDevices(pairedDevicesData);
        
        // Start scanning
        await fetch(`${PI_API_URL}/start-scan`);
        console.log("Started scanning");

        // Start polling device queue
        const interval = setInterval(async () => {
          const deviceArray = await fetchDeviceQueue();
          setDevices(deviceArray);
        }, 1000);
        setScanInterval(interval);
      } catch (err) {
        console.error("Failed to initialize scanning:", err);
      }
    };
  
    initializeScanning();
  
    return () => {
      // Clean up the interval
      if (scanInterval) {
        clearInterval(scanInterval);
        setScanInterval(null);
      }
      
      // Stop the scanning process
      fetch(`${PI_API_URL}/stop-scan`).catch(err => {
        console.error("Failed to stop scanning:", err);
      });
    };
  }, []);

  // Render each device as a clickable item.
  const renderItem = ({ item }: { item: Device }) => {
    const isSelected = selectedDevices[item.mac] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item, selectedDevices, setSelectedDevices)}
        style={[
          styles.deviceItem,
          { backgroundColor: "white" },
          isSelected && styles.selectedDevice
        ]}
      >
        <Text style={styles.deviceName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // Render paired devices with selection capability
  const renderPairedDevice = ({ item }: { item: Device }) => {
    const isSelected = selectedPairedDevices[item.mac] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => togglePairedSelection(item, selectedPairedDevices, setSelectedPairedDevices)}
        style={[
          styles.deviceItem,
          isSelected && styles.selectedDevice
        ]}
      >
        <Text style={styles.deviceName}>{item.name}</Text>
      </TouchableOpacity>
    );
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
        onPress={async () => {
          // Stop scanning immediately when pair button is clicked
          if (scanInterval) {
            clearInterval(scanInterval);
            setScanInterval(null);
          }
          await fetch(`${PI_API_URL}/stop-scan`).catch(err => {
            console.error("Failed to stop scanning:", err);
          });
          
          // Then proceed with pairing
          pairSelectedDevices(
            selectedDevices,
            selectedPairedDevices,
            setPairing,
            configIDParam,
            configName,
            updateConnectionStatus,
            getSpeakers,
            addSpeaker,
            updateSpeakerConnectionStatus,
            addConfiguration,
            router
          );
        }}
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