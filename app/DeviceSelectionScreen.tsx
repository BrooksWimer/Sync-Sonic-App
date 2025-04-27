import React, { useState, useEffect, useCallback } from 'react';
import { 
  Text, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSearchParams } from 'expo-router/build/hooks';
import { 
  addConfiguration, 
  updateConnectionStatus,
  updateSpeakerConnectionStatus,
  addSpeaker, 
  getSpeakers,
  create_configuration
} from './database';
import { Button, H1, useTheme, useThemeName, YStack, View } from 'tamagui';
import { TopBar } from '@/components/TopBar';
import { AlignCenter } from '@tamagui/lucide-icons';
import { Device } from 'react-native-ble-plx';
import LottieView from 'lottie-react-native';
import { Shadow } from 'react-native-shadow-2';
import { useBLEContext } from '../contexts/BLEContext';
import { fetchPairedDevices } from '../utils/ble_functions';

export default function DeviceSelectionScreen() {
  const params = useSearchParams();
  const configName = params.get('configName') || 'Unnamed Configuration';
  const configIDParam = params.get('configID');
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);

  // Get existing devices (object mapping mac -> name) if provided
  const existingDevicesParam = params.get('existingDevices') || "{}";
  let parsedExistingDevices = {};
  try {
    parsedExistingDevices = JSON.parse(existingDevicesParam);
  } catch (e) {
    console.error("Error parsing existingDevices:", e);
  }
  
  const { 
    allDevices,
    scanning,
    scanForSpeakerDevices: startBLEScan,
    stopScan: stopBLEScan,
    connectedDevice
  } = useBLEContext();

  const [selectedDevices, setSelectedDevices] = useState<Record<string, Device>>(parsedExistingDevices);
  const [loading, setLoading] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<Array<{mac: string, name: string}>>([]);
  const [selectedPairedDevices, setSelectedPairedDevices] = useState<Record<string, Device>>({});
  const router = useRouter();
  const [isPairing, setIsPairing] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Start scanning and set up polling for paired devices
  useEffect(() => {
    let mounted = true;
    const initializeScanning = async () => {
      try {
        if (!connectedDevice) {
          console.error("No connected device available");
          return;
        }

        console.log('=== Initializing ===');
        console.log('Connected Device:', connectedDevice.id);
        
        // Fetch paired devices
        console.log('Fetching paired devices...');
        const pairedDevicesData = await fetchPairedDevices(connectedDevice);
        console.log('Paired devices data:', pairedDevicesData);
        
        if (mounted) {
          // Convert the paired devices data to an array of {mac, name} objects
          const pairedDevicesArray = Object.entries(pairedDevicesData).map(([mac, name]) => ({
            mac,
            name: name as string
          }));
          setPairedDevices(pairedDevicesArray);
        }
      } catch (err) {
        console.error("Failed to initialize:", err);
      }
    };
  
    initializeScanning();
  
    return () => {
      mounted = false;
    };
  }, [connectedDevice]);

  // Start scanning for devices when component mounts
  useEffect(() => {
    const startScanning = async () => {
      try {
        console.log('Starting device scan...');
        await startBLEScan();
      } catch (error) {
        console.error('Error starting scan:', error);
      }
    };

    startScanning();

    return () => {
      stopBLEScan();
    };
  }, []);

  // Toggle selection for scanned devices
  const toggleSelection = (device: Device, selectedDevices: Record<string, Device>, setSelectedDevices: React.Dispatch<React.SetStateAction<Record<string, Device>>>) => {
    const newSelectedDevices = { ...selectedDevices };
    if (newSelectedDevices[device.id]) {
      delete newSelectedDevices[device.id];
    } else {
      newSelectedDevices[device.id] = device;
    }
    setSelectedDevices(newSelectedDevices);
  };

  // Toggle selection for paired devices
  const togglePairedSelection = (device: Device, selectedPairedDevices: Record<string, Device>, setSelectedPairedDevices: React.Dispatch<React.SetStateAction<Record<string, Device>>>) => {
    const newSelectedDevices = { ...selectedPairedDevices };
    if (newSelectedDevices[device.id]) {
      delete newSelectedDevices[device.id];
    } else {
      newSelectedDevices[device.id] = device;
    }
    setSelectedPairedDevices(newSelectedDevices);
  };

  // Render each device as a clickable item
  const renderItem = ({ item }: { item: Device }) => {
    // Log device details for debugging
    console.log('Rendering device:', {
      id: item.id,
      name: item.name,
      localName: item.localName,
      serviceUUIDs: item.serviceUUIDs
    });

    // Only render devices with a non-null name or localName
    if (!item.name && !item.localName) {
      console.log('Skipping device with no name:', item.id);
      return null;
    }

    const isSelected = selectedDevices[item.id] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item, selectedDevices, setSelectedDevices)}
        style={[
          styles.deviceItem,
          {shadowColor: tc, borderColor: tc, },
          isSelected && {backgroundColor: pc}
        ]}
      >
        <Text style={[styles.deviceName, isSelected && styles.selectedDeviceText]}>
          {item.name || item.localName || 'Unknown Device'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render paired devices with selection capability
  const renderPairedDevice = ({ item }: { item: { mac: string, name: string } }) => {
    const isSelected = selectedPairedDevices[item.mac] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => togglePairedSelection(
          { id: item.mac, name: item.name } as Device,
          selectedPairedDevices,
          setSelectedPairedDevices
        )}
        style={[
          styles.deviceItem,
          {shadowColor: tc, borderColor: tc, },
          isSelected && {backgroundColor: pc}
        ]}
      >
        <Text style={[styles.deviceName, isSelected && styles.selectedDeviceText]}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const themeName = useThemeName();
  const theme = useTheme();
  
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
  const svbg = themeName === 'dark' ? '#350066' : '#F9F5FF'

  // Debounce function with state tracking
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      if (isDebouncing) return;
      setIsDebouncing(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func(...args);
        setIsDebouncing(false);
      }, wait);
    };
  };

  const handleCreateConfiguration = debounce(async () => {
    if (isPairing || isDebouncing) return;
    
    setIsPairing(true);
    setShowLoadingAnimation(true);
    
    try {
      // Stop scanning immediately when create button is clicked
      if (scanInterval) {
        clearInterval(scanInterval);
        setScanInterval(null);
      }
      await stopBLEScan();
      
      // Combine selected devices and paired devices
      const allSelectedDevices = { ...selectedDevices, ...selectedPairedDevices };
      
      // Convert devices to the format expected by create_configuration
      const speakers = Object.entries(allSelectedDevices).map(([mac, device]) => ({
        name: device.name || 'Unknown Device',
        mac: mac
      }));
      
      // Create the configuration with all selected speakers
      const newConfigID = create_configuration(configName, speakers);
      
      // Navigate to the speaker configuration screen
      router.push({
        pathname: '/SpeakerConfigScreen',
        params: {
          configID: newConfigID.toString(),
          configName: configName
        }
      });
      
    } catch (error) {
      console.error('Error creating configuration:', error);
      Alert.alert('Error', 'Failed to create configuration. Please try again.');
    } finally {
      setIsPairing(false);
      setShowLoadingAnimation(false);
    }
  }, 1000);

  return (
    <YStack flex={1} backgroundColor={bg}>
      <TopBar/>
      
      <View style={{
        paddingTop: 10,
        paddingBottom: 10,
        alignItems: "center",
      }}>
        <H1 style={{ fontSize: 32, fontWeight: "bold", color: tc, fontFamily: "Finlandica", letterSpacing:1}}>Select Speaker</H1>
      </View>

      {showLoadingAnimation && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>
          <View style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1001
          }}>
            <LottieView
              source={themeName === 'dark' 
                ? require('../assets/animations/SyncSonic_Loading_Dark_nbg.json')
                : require('../assets/animations/SyncSonic_Loading_Light_nbg.json')}
              autoPlay
              loop
              style={{ 
                width: 600, 
                height: 600,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: [{ translateX: -300 }, { translateY: -300 }]
              }}
            />
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#FF0055" />
      ) : (
        <FlatList
          data={allDevices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={true}
          indicatorStyle="black"
          ListEmptyComponent={<H1
            style={{ color: tc, fontFamily: "Finlandica", letterSpacing:1 }}
            alignSelf='center'
            fontSize={15}
            lineHeight={44}
            fontWeight="400">
            No devices found
          </H1>}
          style={[styles.list, { 
            backgroundColor: svbg,
            shadowColor: tc,
            borderColor: tc 
          }]}
        />
      )}

      <View style={{
        paddingTop: 10,
        paddingBottom: 5,
        alignItems: "center",
      }}>
        <H1 style={{ fontSize: 32, fontWeight: "bold", color: tc, fontFamily: "Finlandica", letterSpacing: 1}}>Saved Speakers</H1>
      </View>
      <FlatList
        style={[styles.list, 
          { borderColor: tc, 
            backgroundColor: svbg,
            shadowColor: tc
          }]}
        data={pairedDevices}
        keyExtractor={(item) => item.mac}
        renderItem={renderPairedDevice}
        showsVerticalScrollIndicator={true}
        indicatorStyle="black"
        ListEmptyComponent={<H1
          style={{ color: tc,    
                  fontFamily: "Finlandica", 
                  letterSpacing: 1 }}
          alignSelf='center'
          fontSize={15}
          lineHeight={44}
          fontWeight="400">
          No paired devices found
        </H1>}
      />

      <Button
        onPress={handleCreateConfiguration}
        style={[styles.pairButton,
          {
          backgroundColor: pc,
        }]}
      >
        {isPairing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <H1 color="white" fontSize={18} alignSelf='center' fontFamily="Finlandica" letterSpacing={1}>
            Create Configuration
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
    textAlign: 'center',
    color: '#26004E',
    fontFamily: "Finlandica",
    letterSpacing: 1
  },
  list: {
    maxHeight: "30%",
    alignSelf: "center",
    width: "95%",
    marginBottom: 0,
    borderRadius: 15,
    borderWidth: 1,
    padding: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5
  },
  deviceItem: {
    padding: 16,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: "white",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5
  },
  selectedDevice: {
    backgroundColor: '#3E0094',
  },
  deviceName: { 
    fontSize: 18,
    color: '#26004E',
    fontFamily: "Finlandica",
    letterSpacing: 1
  },
  selectedDeviceText: {
    color: 'white'
  },
  emptyText: {
    fontSize: 16,
    color: '#26004E',
    textAlign: 'center',
    fontFamily: "Finlandica",
    letterSpacing:1
  },
  pairButton: {
    backgroundColor: '#3E0094',
    justifyContent: 'center',
    borderRadius: 99,
    alignItems: 'center', 
    width: '90%',
    height: 50,
    marginBottom: "5%",
    marginTop: "7%",
    alignSelf: 'center',
  },
  pairButtonText: { 
    color: '#F2E8FF', 
    fontSize: 18,
    fontFamily: "Finlandica",
    letterSpacing:1
  },
  disabledButton: {
    opacity: 0.7,
  },
});