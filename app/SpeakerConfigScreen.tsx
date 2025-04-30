import { useSearchParams } from 'expo-router/build/hooks';
import {Wifi, WifiOff, Bluetooth, BluetoothOff, Volume2, VolumeX } from '@tamagui/lucide-icons'
import React, { useState, useEffect } from 'react';
import { StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator, View, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter, useNavigation, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  addConfiguration, 
  updateConfiguration, 
  deleteConfiguration, 
  addSpeaker, 
  getSpeakers, 
  getConfigurationStatus, 
  getConfigurationSettings, 
  updateConnectionStatus, 
  updateSpeakerSettings,
  updateSpeakerConnectionStatus,
  getSpeakersFull
} from './database';
import {PI_API_URL, KNOWN_CONTROLLERS} from '../utils/constants'
import { useTheme, useThemeName, YStack, Text } from 'tamagui';
import { TopBar } from '@/components/TopBar';
import { 
  handleVolumeChange,
  handleLatencyChange
} from '../utils/SpeakerFunctions';
import { 
  handleDelete, 
  handleDisconnect, 
  handleConnect,
  handleSave
} from '../utils/ConfigurationFunctions';
import LottieView from 'lottie-react-native';
import { bleConnectOne, bleDisconnectOne, setVolume, setMute } from '../utils/ble_functions';
import { useBLEContext, } from '@/contexts/BLEContext';

export const SERVICE_UUID    = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0000';
const VOLUME_UUID     = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0001';
const CONNECT_UUID    = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0002';

export default function SpeakerConfigScreen() {
  // Retrieve parameters from the URL
  const params = useSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const speakersStr = params.get('speakers'); // JSON string or null
  const configNameParam = params.get('configName') || 'Unnamed Configuration';
  const configIDParam = params.get('configID'); // may be undefined for a new config

  const { dbUpdateTrigger } = useBLEContext();

  // State to hold connected speakers (mapping from mac to name)
  const [connectedSpeakers, setConnectedSpeakers] = useState<{ [mac: string]: string }>({});

  // State for connection status: true means connected
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // State for speaker settings (volume and latency)
  const [settings, setSettings] = useState<{ [mac: string]: { volume: number; latency: number; isConnected: boolean } }>({});

  // State for the free controller (if any)
  const [freeController, setFreeController] = useState<string | null>(null);

  // State for loading indicators
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for loading speakers
  const [loadingSpeakers, setLoadingSpeakers] = useState<{ [mac: string]: { action: 'connect' | 'disconnect' | null } }>({});

  // Add local state for slider values and mute status
  const [sliderValues, setSliderValues] = useState<{
    [mac: string]: {
      volume: number;
      latency: number;
      balance: number;
      isMuted: boolean;
    }
  }>({});



  // Update slider values when settings change
  useEffect(() => {
    const newSliderValues: {
      [mac: string]: {
        volume: number;
        latency: number;
        balance: number;
        isMuted: boolean;
      }
    } = {};
    
    Object.keys(settings).forEach(mac => {
      newSliderValues[mac] = {
        volume: settings[mac]?.volume ?? 50,
        latency: settings[mac]?.latency ?? 100,
        balance: 0.5, // Default balance value
        isMuted: false // Default mute state
      };
    });
    
    setSliderValues(newSliderValues);
  }, [settings]);

  // Load speakers either from the database (if configID exists) or from URL.
  useEffect(() => {
    if (configIDParam) {
      const configIdNum = Number(configIDParam);
  
      // Use the new getSpeakersFull to load *all* speaker data, including is_connected.
      const fullRows = getSpeakersFull(configIdNum);
  
      // Build `connectedSpeakers` and `settings` from these rows.
      const mapping: { [mac: string]: string } = {};
      const loadedSettings: {
        [mac: string]: { volume: number; latency: number; isConnected: boolean };
      } = {};
  
      fullRows.forEach(row => {
        mapping[row.mac] = row.name;
        loadedSettings[row.mac] = {
          volume: row.volume,
          latency: row.latency,
          isConnected: row.is_connected === 1, // Convert DB 0/1 to boolean
        };
      });
  
      setConnectedSpeakers(mapping);
      setSettings(loadedSettings);
  
      // For the overall config status:
      try {
        const status = getConfigurationStatus(configIdNum);
        setIsConnected(status === 1);
      } catch (err) {
        console.error("Error fetching connection status:", err);
      }
    } else {
      // If configIDParam does not exist, we handle a new config or URL with speakers.
      try {
        const spk = speakersStr ? JSON.parse(speakersStr) : {};
        setConnectedSpeakers(spk);
  
        const defaultSettings: {
          [mac: string]: { volume: number; latency: number; isConnected: boolean }
        } = {};
  
        Object.keys(spk).forEach(mac => {
          defaultSettings[mac] = {
            volume: 50,
            latency: 100,
            isConnected: false,
          };
        });
        setSettings(defaultSettings);
      } catch (e) {
        console.error("Error parsing speakers param:", e);
        setConnectedSpeakers({});
      }
    }
  }, [configIDParam, speakersStr, dbUpdateTrigger]);
  
  // Add BLE context
  const { connectedDevice } = useBLEContext();

  const handleVolumeChangeWrapper = async (mac: string, newVolume: number, isSlidingComplete: boolean) => {
    await handleVolumeChange(
      mac,
      newVolume,
      settings,
      setSettings,
      configIDParam,
      updateSpeakerSettings,
      connectedDevice,
      isSlidingComplete
    );
  };

  const handleLatencyChangeWrapper = async (mac: string, newLatency: number, isSlidingComplete: boolean) => {
    await handleLatencyChange(
      mac,
      newLatency,
      settings,
      setSettings,
      configIDParam,
      updateSpeakerSettings,
      isSlidingComplete,
      connectedDevice
    );
  };

  const handleConnectWrapper = async () => {
    await handleConnect(
      configIDParam,
      configNameParam,
      connectedSpeakers,
      settings,
      setSettings,
      setIsConnected,
      setIsConnecting
    );
  };

  const handleDisconnectWrapper = async () => {
    await handleDisconnect(
      configIDParam,
      configNameParam,
      connectedSpeakers,
      settings,
      setSettings,
      setIsConnected,
      setIsDisconnecting
    );
  };

  const handleSoundFieldChange = async (mac: string, newBalance: number, isSlidingComplete: boolean) => {
    // Update local state immediately
    setSliderValues(prev => ({
      ...prev,
      [mac]: { ...prev[mac], balance: newBalance }
    }));

    // If still sliding, don't do server/database updates
    if (!isSlidingComplete) {
      return;
    }
    
    try {
      if (!connectedDevice) {
        console.error('No BLE device connected for sound field change');
        Alert.alert("Error", "No BLE device connected");
        return;
      }

      // Use the same setVolume function with the current volume and new balance
      await setVolume(
        connectedDevice,
        mac,
        settings[mac]?.volume || 50,
        newBalance
      );

      // Update database if we have a config ID
      if (configIDParam) {
        updateSpeakerSettings(
          Number(configIDParam),
          mac,
          settings[mac]?.volume || 50,
          settings[mac]?.latency || 100,
          newBalance
        );
      }
    } catch (error) {
      console.error("Error updating sound field:", error);
      Alert.alert("Error", "Failed to update sound field settings.");
    }
  };

  const handleConnectOne = async (mac: string) => {
    console.log('handleConnectOne triggered for mac:', mac); // Debug log
    
    if (!connectedDevice) {
      console.log('No BLE device connected'); // Debug log
      Alert.alert("Error", "No Bluetooth device connected");
      return;
    }

    console.log('BLE device found:', connectedDevice.id); // Debug log
    setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: 'connect' } }));
    
    try {
      console.log('Attempting bleConnectOne with settings:', { // Debug log
        mac,
        name: connectedSpeakers[mac],
        settings: {
          volume: settings[mac]?.volume || 50,
          latency: settings[mac]?.latency || 100,
          balance: sliderValues[mac]?.balance || 0.5
        }
      });

      // Get all speaker MACs in the configuration from the database
      const allSpeakers = configIDParam ? getSpeakersFull(Number(configIDParam)) : [];
      const allowedMacs = allSpeakers.map(speaker => speaker.mac);

      // Pass the connected device to bleConnectOne
      await bleConnectOne(
        connectedDevice,
        mac,
        connectedSpeakers[mac],
        {
          volume: settings[mac]?.volume || 50,
          latency: settings[mac]?.latency || 100,
          balance: sliderValues[mac]?.balance || 0.5
        },
        allowedMacs  // Pass the allowed MACs
      );
      
      // Update local state
      const updatedSettings = { ...settings };
      updatedSettings[mac].isConnected = true;
      setSettings(updatedSettings);
      
      // Update database if we have a config ID
      if (configIDParam) {
        updateSpeakerConnectionStatus(Number(configIDParam), mac, true);
      }
      
      Alert.alert("Success", `${connectedSpeakers[mac]} connected successfully.`);
    } catch (error) {
      console.error("Error connecting speaker:", error);
      Alert.alert("Connection Error", "Failed to connect speaker via Bluetooth.");
    } finally {
      setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: null } }));
    }
  };

  const handleDisconnectOne = async (mac: string) => {
    setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: 'disconnect' } }));
    
    if (!connectedDevice) {
      console.log('No BLE device connected');
      Alert.alert("Error", "No Bluetooth device connected");
      return;
    }

    try {
      await bleDisconnectOne(connectedDevice, mac);
      
      // Update local state
      const updatedSettings = { ...settings };
      updatedSettings[mac].isConnected = false;
      setSettings(updatedSettings);
      
      // Update database if we have a config ID
      if (configIDParam) {
        updateSpeakerConnectionStatus(Number(configIDParam), mac, false);
      }
      
      Alert.alert("Success", `${connectedSpeakers[mac]} disconnected successfully.`);
    } catch (error) {
      console.error("Error disconnecting speaker:", error);
      Alert.alert("Disconnection Error", "Failed to disconnect speaker.");
    } finally {
      setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: null } }));
    }
  };

  const handleMuteToggle = async (mac: string) => {
    try {
      const isCurrentlyMuted = sliderValues[mac]?.isMuted || false;
      
      if (!connectedDevice) {
        console.error('No BLE device connected for mute toggle');
        Alert.alert("Error", "No BLE device connected");
        return;
      }

      // Use the new BLE-based setMute function
      await setMute(connectedDevice, mac, !isCurrentlyMuted);

      // Update local state
      setSliderValues(prev => ({
        ...prev,
        [mac]: { ...prev[mac], isMuted: !isCurrentlyMuted }
      }));

      // Update database if we have a config ID
      if (configIDParam) {
        updateSpeakerSettings(
          Number(configIDParam), 
          mac, 
          settings[mac]?.volume || 50, 
          settings[mac]?.latency || 100,
          sliderValues[mac]?.balance || 0.5,
          !isCurrentlyMuted
        );
      }
    } catch (error) {
      console.error("Error toggling mute:", error);
      Alert.alert("Error", "Failed to toggle mute.");
    }
  };

  const themeName = useThemeName();
      const theme = useTheme();
    
    
      const imageSource = themeName === 'dark'
        ? require('../assets/images/welcomeGraphicDark.png')
        : require('../assets/images/welcomeGraphicLight.png')
     
      const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
      const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
      const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
      const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'
      const green = themeName === 'dark' ? '#00FF6A' : '#34A853'
      const red = themeName === 'dark' ? 'black' : '#E8004D'

      const { width: screenWidth } = Dimensions.get('window');

    // Estimate the font size based on screen width and expected text length
    // You can tweak the divisor (e.g., 0.05 * screenWidth) to find the best fit
    const estimatedFontSize = Math.min(40, screenWidth / (configNameParam.length + 12));


      return (
        <YStack flex={1} backgroundColor={bg}>
          <TopBar/>
          <Text style={{ fontFamily: 'Finlandica', fontSize: 25, fontWeight: "bold", color: tc, marginBottom: 10, marginTop: 20, alignSelf: 'center' }}>
            {configNameParam}
          </Text>
          
          {/* LEAVE THIS EMPTY */}
          <Text>  </Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 15 }}>
            
            
            {Object.keys(connectedSpeakers).length === 0 ? (
              <Text style={{ fontFamily: 'Finlandica' }}>No connected speakers found.</Text>
            ) : (
              Object.keys(connectedSpeakers).map((mac, index) => (
                <SafeAreaView key={mac} style={{ 
                  width:"90%",
                  alignSelf:"center", 
                  marginTop: index === 0 ? 7 : 0,
                  marginBottom: 15, 
                  paddingLeft: 20, 
                  paddingRight: 20, 
                  paddingBottom: 5, 
                  paddingTop: 5,
                  backgroundColor: bg,
                  borderWidth: 1, 
                  borderColor: stc,
                  borderRadius: 8, 
                  shadowColor: themeName === 'dark' ? '#000000' : stc,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: themeName === 'dark' ? 0.9 : 0.5,
                  shadowRadius: themeName === 'dark' ? 12 : 8,
                  elevation: themeName === 'dark' ? 15 : 10,
                  position: 'relative'
                }}>
                  <View style={{
                    position: 'absolute',
                    top: 20,
                    left: 15,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: settings[mac]?.isConnected ? green : '#FF0055',
                    shadowColor: themeName === 'dark' ? '#000000' : tc,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: themeName === 'dark' ? 0.9 : 0.6,
                    shadowRadius: themeName === 'dark' ? 6 : 4,
                    elevation: themeName === 'dark' ? 8 : 5,
                    borderWidth: themeName === 'dark' ? 1 : 0,
                    borderColor: themeName === 'dark' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    zIndex: 2
                  }} />
                  <Text style={{ 
                    fontFamily: 'Finlandica', 
                    fontSize: 24, 
                    fontWeight: "bold", 
                    color: tc, 
                    alignSelf: 'center',
                    marginTop: 0
                  }}>
                    {connectedSpeakers[mac]}
                  </Text>
                  <Text style={{ 
                    fontFamily: 'Finlandica', 
                    fontSize: 18, 
                    fontWeight: "bold", 
                    color: tc, 
                    marginTop: 20
                  }}>
                    Volume: {settings[mac]?.volume || 50}%
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    value={settings[mac]?.volume || 50}
                    onValueChange={(value: number) => handleVolumeChangeWrapper(mac, value, false)}
                    onSlidingComplete={(value: number) => handleVolumeChangeWrapper(mac, value, true)}
                    minimumTrackTintColor={pc}
                    maximumTrackTintColor="#000000"
                    thumbTintColor="white" 
                  />
                  <Text style={{ fontFamily: 'Finlandica', fontSize: 18, fontWeight: "bold", color: tc, marginTop: 6 }}>Latency: {settings[mac]?.latency ?? 100} ms</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={500}
                    step={10}
                    value={settings[mac]?.latency ?? 100}
                    onValueChange={(value: number) => handleLatencyChangeWrapper(mac, value, false)}
                    onSlidingComplete={(value: number) => handleLatencyChangeWrapper(mac, value, true)}
                    minimumTrackTintColor={pc}
                    maximumTrackTintColor="#000000"
                    thumbTintColor="white" 
                  />
                  <View style={styles.soundFieldContainer}>
                    <Text style={{ fontFamily: 'Finlandica', fontSize: 18, fontWeight: "bold", color: tc }}>
                      {Math.round((sliderValues[mac]?.balance ?? 0.5) >= 0.5 ? (settings[mac]?.volume ?? 50) * (1 - (sliderValues[mac]?.balance ?? 0.5)) * 2 : (settings[mac]?.volume ?? 50))}%
                    </Text>
                    <Text style={{ fontFamily: 'Finlandica', fontSize: 18, fontWeight: "bold", color: tc }}>Sound Field</Text>
                    <Text style={{ fontFamily: 'Finlandica', fontSize: 18, fontWeight: "bold", color: tc }}>
                      {Math.round((sliderValues[mac]?.balance ?? 0.5) <= 0.5 ? (settings[mac]?.volume ?? 50) * (sliderValues[mac]?.balance ?? 0.5) * 2 : (settings[mac]?.volume ?? 50))}%
                    </Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.01}
                    value={sliderValues[mac]?.balance ?? 0.5}
                    onValueChange={(value: number) => {
                      setSliderValues(prev => ({
                        ...prev,
                        [mac]: { ...prev[mac], balance: value }
                      }));
                      handleSoundFieldChange(mac, value, false);
                    }}
                    onSlidingComplete={(value: number) => {
                      setSliderValues(prev => ({
                        ...prev,
                        [mac]: { ...prev[mac], balance: value }
                      }));
                      handleSoundFieldChange(mac, value, true);
                    }}
                    minimumTrackTintColor={pc}
                    maximumTrackTintColor="#000000"
                    thumbTintColor="white"
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 10, paddingHorizontal: 10 }}>
                    <TouchableOpacity 
                      onPress={() => handleConnectOne(mac)}
                      disabled={!!loadingSpeakers[mac]?.action}
                    >
                      <Text style={{ 
                        fontFamily: 'Finlandica', 
                        fontSize: 18, 
                        fontWeight: "bold", 
                        color: !!loadingSpeakers[mac]?.action ? stc : themeName === 'dark' ? '#FFFFFF' : '#3E0094'
                      }}>
                        {loadingSpeakers[mac]?.action === 'connect' ? 'Connecting...' : 'Connect'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMuteToggle(mac)}>
                      {sliderValues[mac]?.isMuted ? (
                        <VolumeX size={24} color="#FF0055" />
                      ) : (
                        <Volume2 size={24} color={themeName === 'dark' ? '#FFFFFF' : pc} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDisconnectOne(mac)}
                      disabled={!!loadingSpeakers[mac]?.action}
                    >
                      <Text style={{ 
                        fontFamily: 'Finlandica', 
                        fontSize: 18, 
                        fontWeight: "bold", 
                        color: !!loadingSpeakers[mac]?.action ? stc : '#FF0055'
                      }}>
                        {loadingSpeakers[mac]?.action === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              ))
            )}
            
           
          </ScrollView>
        </YStack>
      );
    }
    
    const styles = StyleSheet.create({
      container: { flex: 1, padding: 20, backgroundColor: '#fff' },
      header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
      speakerContainer: {},
      speakerName: { fontSize: 18, marginBottom: 10 },
      label: { fontSize: 15, marginTop: 10, fontWeight: "bold"},
      slider: { width: '100%', height: 40, marginBottom: -5},
      instructions: { fontSize: 14, marginTop: 10, textAlign: 'center' },
      buttonContainer: { alignItems: "center", flexDirection: 'row', justifyContent: 'space-around', marginTop: 75 },
      saveButton: { backgroundColor: '#3E0094', padding: 15, borderRadius: 8 },
      disconnectButton: { backgroundColor: "#FFFFFF", padding: 15, borderRadius: 8 },
      deleteButton: { backgroundColor: '#FF0055', padding: 15, borderRadius: 8 },
      buttonText: { color: '#fff', fontSize: 16,alignSelf: 'center', },
      homeButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        padding: 15,
        borderRadius: 15,
        backgroundColor: '#3E0094',
        justifyContent: 'center',
        alignItems: 'center',
      },
      homeButtonText: { 
        color: '#F2E8FF', 
        fontSize: 16,
        fontFamily: "Finlandica"
      },
      disabledButton: {
        opacity: 0.7,
      },
      statusDot: {
        width: 20,
        height: 20,
        borderRadius: 10
      },
      soundFieldContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 5,
      },
    });