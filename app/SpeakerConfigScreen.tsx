import { useSearchParams } from 'expo-router/build/hooks';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator, View, Dimensions, Platform } from 'react-native';
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
import { useTheme, useThemeName, YStack, Text, H1 } from 'tamagui';
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
import { useFocusEffect } from '@react-navigation/native';
import { Bluetooth, BluetoothOff, Volume2, VolumeX } from '@tamagui/lucide-icons';
import * as Font from 'expo-font';





export default function SpeakerConfigScreen() {
  // Retrieve parameters from the URL
  const params = useSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const speakersStr = params.get('speakers'); // JSON string or null
  const configNameParam = params.get('configName') || 'Unnamed Configuration';
  const configIDParam = params.get('configID'); // may be undefined for a new config
  const [fontsLoaded, setFontsLoaded] = useState(false);
    
      useEffect(() => {
        async function loadFonts() {
          await Font.loadAsync({
            'Finlandica-Regular': require('../assets/fonts/Finlandica-Regular.ttf'),
            'Finlandica-Medium': require('../assets/fonts/Finlandica-Medium.ttf'),
            'Finlandica-SemiBold': require('../assets/fonts/Finlandica-SemiBold.ttf'),
            'Finlandica-Bold': require('../assets/fonts/Finlandica-Bold.ttf'),
            'Finlandica-Italic': require('../assets/fonts/Finlandica-Italic.ttf'),
            'Finlandica-SemiBoldItalic': require('../assets/fonts/Finlandica-SemiBoldItalic.ttf'),
            'Finlandica-BoldItalic': require('../assets/fonts/Finlandica-BoldItalic.ttf'),
          });
          setFontsLoaded(true);
        }
    
        loadFonts();
      }, []);
  

  // State to hold connected speakers (mapping from mac to name)
  const [connectedSpeakers, setConnectedSpeakers] = useState<{ [mac: string]: string }>({});

  // State for connection status: true means connected
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // State for speaker settings (volume and latency)
  const [settings, setSettings] = useState<{ [mac: string]: { volume: number; latency: number; isConnected: boolean; balance: number; isMuted: boolean } }>({});

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

  // Add local state for slider values
  const [sliderValues, setSliderValues] = useState<{
    [mac: string]: {
      volume: number;
      latency: number;
      balance: number;
    }
  }>({});

  // Update slider values when settings change
  useEffect(() => {
    const newSliderValues: {
      [mac: string]: {
        volume: number;
        latency: number;
        balance: number;
      }
    } = {};
    
    Object.keys(settings).forEach(mac => {
      newSliderValues[mac] = {
        volume: settings[mac]?.volume ?? 50,
        latency: settings[mac]?.latency ?? 100,
        balance: settings[mac]?.balance ?? 0.5
      };
    });
    
    setSliderValues(newSliderValues);
  }, [settings]);

  // Load speakers either from the database (if configID exists) or from URL.
  useFocusEffect(
    useCallback(() => {
      console.log("useFocusEffect running with configIDParam:", configIDParam);
      
      if (configIDParam) {
        const configIdNum = Number(configIDParam);
        console.log("Loading data for config ID:", configIdNum);
    
        // Use the new getSpeakersFull to load *all* speaker data, including is_connected.
        const fullRows = getSpeakersFull(configIdNum);
        console.log("Loaded fullRows:", fullRows);
    
        // Build `connectedSpeakers` and `settings` from these rows.
        const mapping: { [mac: string]: string } = {};
        const loadedSettings: {
          [mac: string]: { volume: number; latency: number; isConnected: boolean; balance: number; isMuted: boolean };
        } = {};
    
        fullRows.forEach(row => {
          console.log("Processing row:", row);
          mapping[row.mac] = row.name;
          loadedSettings[row.mac] = {
            volume: row.volume || 50,
            latency: row.latency || 100,
            isConnected: row.is_connected === 1,
            balance: row.balance || 0.5,
            isMuted: row.is_muted === 1
          };
        });
    
        console.log("Setting connectedSpeakers:", mapping);
        console.log("Setting settings:", loadedSettings);
        setConnectedSpeakers(mapping);
        setSettings(loadedSettings);
    
        // For the overall config status:
        try {
          const status = getConfigurationStatus(configIdNum);
          console.log("Configuration status:", status);
          setIsConnected(status === 1);
        } catch (err) {
          console.error("Error fetching connection status:", err);
        }
      } else {
        console.log("No configIDParam, handling new config or URL with speakers");
        // If configIDParam does not exist, we handle a new config or URL with speakers.
        try {
          const spk = speakersStr ? JSON.parse(speakersStr) : {};
          console.log("Parsed speakers from URL:", spk);
          setConnectedSpeakers(spk);
    
          const defaultSettings: {
            [mac: string]: { volume: number; latency: number; isConnected: boolean; balance: number; isMuted: boolean }
          } = {};
    
          Object.keys(spk).forEach(mac => {
            defaultSettings[mac] = {
              volume: 50,
              latency: 100,
              isConnected: false,
              balance: 0.5,
              isMuted: false
            };
          });
          console.log("Setting default settings:", defaultSettings);
          setSettings(defaultSettings);
        } catch (e) {
          console.error("Error parsing speakers param:", e);
          setConnectedSpeakers({});
        }
      }
    }, [configIDParam, speakersStr])
  );
  


  const handleVolumeChangeWrapper = async (mac: string, newVolume: number, isSlidingComplete: boolean) => {
    await handleVolumeChange(
      mac,
      newVolume,
      settings,
      setSettings,
      configIDParam,
      updateSpeakerSettings,
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
      isSlidingComplete
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
    const updatedSettings = { ...settings };
    if (updatedSettings[mac]) {
      updatedSettings[mac].balance = newBalance;
    }
    setSettings(updatedSettings);

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
          settings[mac]?.volume || 50, 
          settings[mac]?.latency || 100,
          newBalance
        );
      }

      // Then update server
      const payload = {
        mac: mac,
        volume: settings[mac]?.volume || 50,
        balance: newBalance
      };

      const response = await fetch(`${PI_API_URL}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
    } catch (error) {
      console.error("Error updating sound field:", error);
      Alert.alert("Error", "Failed to update sound field settings.");
    }
  };

  const handleConnectOne = async (mac: string) => {
    setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: 'connect' } }));
    const payload = {
      speakers: connectedSpeakers,
      settings: settings,
      targetSpeaker: {
        mac: mac,
        name: connectedSpeakers[mac]
      }
    };

    try {
      const response = await fetch(`${PI_API_URL}/connect-one`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      
      const updatedSettings = { ...settings };
      updatedSettings[mac].isConnected = true;
      setSettings(updatedSettings);
      
      if (configIDParam) {
        updateSpeakerConnectionStatus(Number(configIDParam), mac, true);
      }
      
      Alert.alert("Success", `${connectedSpeakers[mac]} connected successfully.`);
    } catch (error) {
      console.error("Error connecting speaker:", error);
      Alert.alert("Connection Error", "Failed to connect speaker.");
    } finally {
      setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: null } }));
    }
  };

  const handleDisconnectOne = async (mac: string) => {
    setLoadingSpeakers(prev => ({ ...prev, [mac]: { action: 'disconnect' } }));
    const payload = {
      configID: configIDParam,
      configName: configNameParam,
      speakers: {
        [mac]: connectedSpeakers[mac]
      },
      settings: {
        [mac]: settings[mac]
      }
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
      
      const updatedSettings = { ...settings };
      updatedSettings[mac].isConnected = false;
      setSettings(updatedSettings);
      
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
      const isCurrentlyMuted = settings[mac]?.isMuted || false;
      
      const response = await fetch(`${PI_API_URL}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac: mac,
          mute: !isCurrentlyMuted  // Toggle the mute state
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // Update local settings
      const updatedSettings = { ...settings };
      if (updatedSettings[mac]) {
        updatedSettings[mac].isMuted = !isCurrentlyMuted;
      }
      setSettings(updatedSettings);

      // Update database if we have a config ID
      if (configIDParam) {
        updateSpeakerSettings(
          Number(configIDParam), 
          mac, 
          settings[mac]?.volume || 50, 
          settings[mac]?.latency || 100,
          settings[mac]?.balance || 0.5,
          !isCurrentlyMuted  // Pass the new mute state
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
     
        const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'   //background
        const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'   //primary (pink/purple)
        const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'   // text color
        const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'    // subtext color
        const green = themeName === 'dark' ? '#00FF6A' : '#34A853'    // green is *slightly* different on light/dark 
        const red = themeName === 'dark' ? '' : '#E8004D'  // red is actually black on dark mode due to similarity of pc

        //if android
            let buffer = 20
            //else, 
            if (Platform.OS === 'ios') {
              buffer = 0
            }

      const { width: screenWidth } = Dimensions.get('window');

    // Estimate the font size based on screen width and expected text length
    // You can tweak the divisor (e.g., 0.05 * screenWidth) to find the best fit
    const estimatedFontSize = Math.min(40, screenWidth / (configNameParam.length + 12));


      return (
        <YStack flex={1} backgroundColor={bg}>
          <TopBar/>
          {/* Header */}
          <View style={{
                    paddingTop: 20,
                    paddingBottom: 10,
                    alignItems: "center",
                    backgroundColor: bg
                }}>
          <H1 style={{ color: tc, fontFamily: "Finlandica-Medium", fontSize: 40, lineHeight: 44, marginBottom: 5, marginTop: 15, letterSpacing: 1 }}>
                    {configNameParam}
          </H1>
          </View>
          
          <ScrollView contentContainerStyle={{ paddingBottom: 15 }}>
            
            
            {Object.keys(connectedSpeakers).length === 0 ? (
              <Text style={{ fontFamily: 'Finlandica' }}>No connected speakers found.</Text>
            ) : (
              Object.keys(connectedSpeakers).map((mac, index) => (
                <SafeAreaView key={mac} style={{ width:"90%",
                                                alignSelf:"center", 
                                                marginTop: index === 0 ? 15 : 0, // 👈 only the first item gets top margin
                                                marginBottom: 15, 
                                                paddingLeft: 20, 
                                                paddingRight: 20, 
                                                paddingBottom: 5 + buffer, 
                                                paddingTop: 5 + buffer,
                                                backgroundColor: bg,
                                                borderWidth: 1, 
                                                borderColor: stc,
                                                borderRadius: 8, 
                                                shadowColor: tc,
                                                shadowOffset: { width: 0, height: 0 },
                                                shadowOpacity: 0.8,
                                                shadowRadius: 8,
                                                //height: 300,
                                                elevation: 10}}>
                  
                  <Text style={{ fontFamily: 'Finlandica-Medium', fontSize: 28, color: tc, marginTop: 0, alignSelf: 'center',  }}>{connectedSpeakers[mac]}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ 
                      fontFamily: 'Finlandica-Medium', 
                      fontSize: 18, 
                      color: tc, 
                      marginTop: 6,
                      letterSpacing: 1
                    }}>
                      Volume: {settings[mac]?.volume ?? 50}%
                    </Text>
                    
                    <TouchableOpacity onPress={() => handleMuteToggle(mac)}>
                      {settings[mac]?.isMuted ? (
                        <VolumeX
                          size={24}
                          color={pc}
                        />
                      ) : (
                        <Volume2
                          size={24}
                          color={pc}
                        />
                      )}
                    </TouchableOpacity>
                  </View>

                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    value={sliderValues[mac]?.volume ?? 50}
                     onValueChange={(value: number) => {
                       setSliderValues(prev => ({
                         ...prev,
                         [mac]: { ...prev[mac], volume: value }
                       }));
                       handleVolumeChangeWrapper(mac, value, false);
                     }}
                     onSlidingComplete={(value: number) => {
                       setSliderValues(prev => ({
                         ...prev,
                         [mac]: { ...prev[mac], volume: value }
                       }));
                       handleVolumeChangeWrapper(mac, value, true);
                     }}
                    minimumTrackTintColor={pc}
                    maximumTrackTintColor="#000000"
                    thumbTintColor="white" 
                  />
                  
                  <Text style={{ fontFamily: 'Finlandica-Medium', fontSize: 18, letterSpacing: 1, color: tc, marginTop: 6 }}>
                    Latency: {settings[mac]?.latency ?? 100} ms
                  </Text>
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
                  {/* Left side (L) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: tc,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 6
                    }}>
                      <Text style={{
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: tc,
                      }}>
                        L
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Finlandica-Medium', fontSize: 18, color: tc, letterSpacing: 1 }}>
                      {Math.round((settings[mac]?.balance ?? 0.5) >= 0.5 ? (settings[mac]?.volume ?? 50) * (1 - (settings[mac]?.balance ?? 0.5)) * 2 : (settings[mac]?.volume ?? 50))}%
                    </Text>
                  </View>

                  {/* Middle (Sound Field) */}
                  <Text style={{ fontFamily: 'Finlandica-Medium', fontSize: 18, color: tc, letterSpacing: 1 }}>
                    Sound Field
                  </Text>

                  {/* Right side (R) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Finlandica-Medium', fontSize: 18, color: tc, letterSpacing: 1 }}>
                      {Math.round((settings[mac]?.balance ?? 0.5) <= 0.5 ? (settings[mac]?.volume ?? 50) * (settings[mac]?.balance ?? 0.5) * 2 : (settings[mac]?.volume ?? 50))}%
                    </Text>
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: tc,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginLeft: 6, // small spacing between number and circle
                    }}>
                      <Text style={{
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: tc,
                      }}>
                        R
                      </Text>
                    </View>
                  </View>
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

                  

<View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 5, marginBottom: 10, paddingHorizontal: 10 }}>
  
  {/* Connect Button */}
  <TouchableOpacity 
    onPress={() => handleConnectOne(mac)}
    disabled={!!loadingSpeakers[mac]?.action}
    style={{
      borderWidth: 1.5,
      padding: 10,
      borderRadius: 10,
      borderColor: tc,
      opacity: isConnected ? 0.4 : 1, // dim if already connected
    }}
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

  {/* Disconnect Button */}
  <TouchableOpacity 
    onPress={() => handleDisconnectOne(mac)}
    disabled={!!loadingSpeakers[mac]?.action}
    style={{
      borderWidth: 1.5,
      padding: 10,
      borderRadius: 10,
      borderColor: tc,
      opacity: isConnected ? 1 : 0.4, // dim if not connected
    }}
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
      buttonText: { color: '#fff', fontSize: 18, fontFamily: "Finlandica", alignSelf: 'center', },
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