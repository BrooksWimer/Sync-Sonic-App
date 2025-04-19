import React, { useState, useEffect } from 'react';
import { 
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
import { Button, H1, useTheme, useThemeName, YStack, View } from 'tamagui';
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
import LottieView from 'lottie-react-native';
import { Shadow } from 'react-native-shadow-2'

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
  const [isPairing, setIsPairing] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Start scanning and set up polling for device queue
  useEffect(() => {
    let mounted = true;
    const initializeScanning = async () => {
      try {
        // Fetch paired devices first
        const pairedDevicesData = await fetchPairedDevices();
        if (mounted) {
          setPairedDevices(pairedDevicesData);
        }
        
        // Start scanning
        await fetch(`${PI_API_URL}/start-scan`);
        console.log("Started scanning");

        // Start polling device queue
        const interval = setInterval(async () => {
          if (mounted) {
            const deviceArray = await fetchDeviceQueue();
            setDevices(deviceArray);
          }
        }, 1000);
        setScanInterval(interval);
      } catch (err) {
        console.error("Failed to initialize scanning:", err);
      }
    };
  
    initializeScanning();
  
    return () => {
      mounted = false;
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
          {shadowColor: tc, borderColor: tc, },
          isSelected && {backgroundColor: pc}
        ]}
      >
        <Text style={[styles.deviceName, isSelected && styles.selectedDeviceText]}>{item.name}</Text>
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
          {shadowColor: tc, borderColor: tc, },
          isSelected && {backgroundColor:pc}
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

  const handlePairDevices = debounce(async () => {
    if (isPairing || isDebouncing) return;
    
    setIsPairing(true);
    setShowLoadingAnimation(true);
    
    try {
      // Stop scanning immediately when pair button is clicked
      if (scanInterval) {
        clearInterval(scanInterval);
        setScanInterval(null);
      }
      await fetch(`${PI_API_URL}/stop-scan`).catch(err => {
        console.error("Failed to stop scanning:", err);
      });
      
      // Then proceed with pairing
      await pairSelectedDevices(
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
    } finally {
      setIsPairing(false);
      setShowLoadingAnimation(false);
    }
  }, 1000); // 1 second debounce

  return (
     <YStack flex={1} backgroundColor={bg}>
            {/* Top Bar with Back Button */}
            <TopBar/>

            {/* Header */}
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
                data={devices}
                keyExtractor={(item) => item.mac}
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

            {/* Header */}
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
                  
              data={Object.entries(pairedDevices).map(([mac, name]) => ({ mac, name }))}
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
              onPress={handlePairDevices}
              style={[styles.pairButton,
                {
                backgroundColor: pc,
                
              }]}
            >
              {pairing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <H1 color="white" fontSize={18} alignSelf='center' fontFamily="Finlandica" letterSpacing={1}>
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
    //padding: 15,
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