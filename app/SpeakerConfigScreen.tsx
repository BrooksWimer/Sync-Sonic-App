import { useSearchParams } from 'expo-router/build/hooks';
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





export default function SpeakerConfigScreen() {
  // Retrieve parameters from the URL
  const params = useSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const speakersStr = params.get('speakers'); // JSON string or null
  const configNameParam = params.get('configName') || 'Unnamed Configuration';
  const configIDParam = params.get('configID'); // may be undefined for a new config

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
          isConnected: row.is_connected === 1 // Convert DB 0/1 to boolean
        };
      });
  
      setConnectedSpeakers(mapping);
  
      // For the overall config status:
      try {
        const status = getConfigurationStatus(configIdNum);
        setIsConnected(status === 1);
      } catch (err) {
        console.error("Error fetching connection status:", err);
      }
  
      // Now we have all speaker info, including isConnected, from the DB.
      setSettings(loadedSettings);
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
            isConnected: false
          };
        });
        setSettings(defaultSettings);
      } catch (e) {
        console.error("Error parsing speakers param:", e);
        setConnectedSpeakers({});
      }
    }
  }, [configIDParam, speakersStr]);
  


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

  const themeName = useThemeName();
      const theme = useTheme();
    
    
      const imageSource = themeName === 'dark'
        ? require('../assets/images/welcomeGraphicDark.png')
        : require('../assets/images/welcomeGraphicLight.png')
     
      const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
      const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
      const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
      const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'

      const { width: screenWidth } = Dimensions.get('window');

    // Estimate the font size based on screen width and expected text length
    // You can tweak the divisor (e.g., 0.05 * screenWidth) to find the best fit
    const estimatedFontSize = Math.min(40, screenWidth / (configNameParam.length + 12));


      return (
        <YStack flex={1} backgroundColor={bg}>
          <TopBar/>
          <Text style={{ fontFamily: 'Finlandica', fontSize: 25, fontWeight: "bold", color: tc, marginBottom: 10, marginTop: 20, alignSelf: 'center' }}>
            Speaker Configuration: {configNameParam}
          </Text>
          
          <Text style={{ fontFamily: 'Finlandica', fontSize: 15, fontWeight: "bold", color: tc, marginTop: 0, alignSelf: 'center', marginBottom: 5 }}>
            Adjust the sliders for each speaker as needed.
          </Text>
          <Text>  </Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 15 }}>
            
            
            {Object.keys(connectedSpeakers).length === 0 ? (
              <Text style={{ fontFamily: 'Finlandica' }}>No connected speakers found.</Text>
            ) : (
              Object.keys(connectedSpeakers).map(mac => (
                <SafeAreaView key={mac} style={{ width:"90%" ,alignSelf:"center", marginBottom: 15, paddingLeft: 20, paddingRight: 20, borderWidth: 1, borderColor: stc, borderRadius: 8}}>
                  <Text style={{ fontFamily: 'Finlandica', fontSize: 24, fontWeight: "bold", color: tc, marginTop: -25, alignSelf: 'center' }}>{connectedSpeakers[mac]}</Text>
                  <Text style={{ fontFamily: 'Finlandica', fontSize: 18, fontWeight: "bold", color: tc, marginTop: 6 }}>Volume: {settings[mac]?.volume || 50}%</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    value={settings[mac]?.volume || 50}
                    onValueChange={(value: number) => handleVolumeChangeWrapper(mac, value, false)}
                    onSlidingComplete={(value: number) => handleVolumeChangeWrapper(mac, value, true)}
                    minimumTrackTintColor="#FF0055"
                    maximumTrackTintColor="#000000"
                    thumbTintColor="white" 
                  />
                  <Text style={{ fontFamily: 'Finlandica', fontSize: 18, fontWeight: "bold", color: tc, marginTop: 6 }}>Latency: {settings[mac]?.latency || 100} ms</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={500}
                    step={10}
                    value={settings[mac]?.latency ?? 100}
                    onValueChange={(value: number) => handleLatencyChangeWrapper(mac, value, false)}
                    onSlidingComplete={(value: number) => handleLatencyChangeWrapper(mac, value, true)}
                    minimumTrackTintColor="#FF0055"
                    maximumTrackTintColor="#000000"
                    thumbTintColor="white" 
                  />
                </SafeAreaView>
              ))
            )}
            
           
          </ScrollView>

           <SafeAreaView style={styles.buttonContainer}>
              {configIDParam ? (
                isConnected ? (
                  <TouchableOpacity style={{ width: "90%", alignSelf: "center", backgroundColor: pc, padding: 15, borderRadius: 8, position: 'absolute', bottom: 10, left: "5%"}} onPress={() => handleDisconnectWrapper()}>
                    <Text style={styles.buttonText}>Disconnect Configuration</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={{width: "90%", alignSelf: "center", backgroundColor: pc, padding: 15, borderRadius: 8, position: 'absolute', bottom: 10, left: "5%"}} onPress={() => handleConnectWrapper()}>
                    <Text style={styles.buttonText}>Connect Configuration</Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity style={styles.saveButton} onPress={() => handleSave(configIDParam, configNameParam, connectedSpeakers, setIsSaving)}>
                  <Text style={styles.buttonText}>Save Configuration</Text>
                </TouchableOpacity>
              )}
              
            </SafeAreaView>
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
      buttonContainer: { alignItems: "center", flexDirection: 'row', justifyContent: 'space-around', marginTop: 50 },
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
    });