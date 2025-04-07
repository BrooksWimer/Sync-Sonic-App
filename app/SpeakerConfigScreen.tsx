import { useSearchParams } from 'expo-router/build/hooks';
import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
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
import {PI_API_URL} from '../utils/consts'
import { useTheme, useThemeName, YStack } from 'tamagui';
import { TopBar } from '@/components/TopBar';




// Define known controllers with a Record type for TypeScript.
const KNOWN_CONTROLLERS: Record<string, string> = {
  "BC:FC:E7:21:1A:0B": "raspberry pi #1",
  "BC:FC:E7:21:21:C6": "raspberry pi #2",
  "2C:CF:67:CE:57:91": "raspberry pi"
};

export default function SpeakerConfigScreen() {
  // Retrieve parameters from the URL
  const params = useSearchParams();
  const router = useRouter();
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
  

  // Handler to check which controller is free by calling the bluetooth-ports endpoint.
  const handleCheckPort = async () => {
    setIsCheckingPort(true);
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
      setFreeController(free);
      if (free) {
        Alert.alert("Connect Phone", `Connect phone to ${free}`);
      } else {
        Alert.alert("Connect Phone", "All ports are connected to speakers.");
      }
    } catch (error) {
      console.error("Error checking bluetooth ports:", error);
      Alert.alert("Error", "Failed to check bluetooth ports.");
    } finally {
      setIsCheckingPort(false);
    }
  };

  const adjustVolume = async (mac: string, volume: number) => {
    try {
      const response = await fetch(`${PI_API_URL}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, volume })
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    } catch (error) {
      console.error(`Error setting volume for ${mac}:`, error);
      Alert.alert("Volume Error", `Failed to set volume for ${connectedSpeakers[mac]}`);
    }
  };

  const adjustLatency = async (mac: string, latency: number) => {
    try {
      const response = await fetch(`${PI_API_URL}/latency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, latency })
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    } catch (error) {
      console.error(`Error setting latency for ${mac}:`, error);
      Alert.alert("Latency Error", `Failed to set latency for ${connectedSpeakers[mac]}`);
    }
  };

  const handleVolumeChange = (mac: string, newVolume: number) => {
    setSettings(prev => ({ ...prev, [mac]: { ...prev[mac], volume: newVolume } }));
    adjustVolume(mac, newVolume);
    if (configIDParam) {
      updateSpeakerSettings(Number(configIDParam), mac, newVolume, settings[mac]?.latency || 100);
    }
  };

  const handleLatencyChange = (mac: string, newLatency: number) => {
    setSettings(prev => ({ ...prev, [mac]: { ...prev[mac], latency: newLatency } }));
    adjustLatency(mac, newLatency);
    if (configIDParam) {
      updateSpeakerSettings(Number(configIDParam), mac, settings[mac]?.volume || 50, newLatency);
    }
  };

  // Function to check if all speakers are connected
  const areAllSpeakersConnected = () => {
    return Object.keys(connectedSpeakers).every(mac => settings[mac]?.isConnected);
  };

  const handleConnect = async () => {
    if (areAllSpeakersConnected()) {
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
    
      // Example result:
      // {
      //   "F8:5C:7D:C7:B3:68": { "name": "Will's JBL", "result": "Error in Connect Only" },
      //   "F4:4E:FD:9C:6F:B0": { "name": "NS-SBAR21F20", "result": "Connected" },
      //   "00:0C:8A:FF:18:FE": { "name": "Bose Color SoundLink", "result": "Connected" }
      // }
    
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

  const handleDisconnect = async () => {
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

  const handleSave = async () => {
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (configIDParam) {
        deleteConfiguration(Number(configIDParam));
      }
      router.replace('/home');
    } catch (error) {
      console.error("Error deleting configuration:", error);
      Alert.alert("Delete Error", "Failed to delete configuration.");
    } finally {
      setIsDeleting(false);
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

      return (
        <YStack flex={1} backgroundColor={bg}>
          <TopBar/>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <Text style={{ fontSize: 22, fontWeight: "bold", color: tc, fontFamily: "Finlandica", marginBottom: 15, marginTop: 15, alignSelf:'center' }}>
              Speaker Configuration: {configNameParam}
            </Text>
            {Object.keys(connectedSpeakers).length === 0 ? (
              <Text style={{color:stc, alignSelf: 'center'}}>No connected speakers found.</Text>
            ) : (
              Object.keys(connectedSpeakers).map(mac => (
                <SafeAreaView key={mac} style={{ width:"90%" ,alignSelf:"center", marginBottom: 15, padding: 10, borderWidth: 1, borderColor: stc, borderRadius: 8}}>
                  <Text style={{ fontSize: 20, fontWeight: "bold", color: tc, fontFamily: "Finlandica", marginTop:-15}}>{connectedSpeakers[mac]}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "bold", color: tc, fontFamily: "Finlandica", marginTop:6}}>Volume: {settings[mac]?.volume || 50}%</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    value={settings[mac]?.volume || 50}
                    onSlidingComplete={(value: number) => handleVolumeChange(mac, value)}
                    minimumTrackTintColor="#FF0055"
                    maximumTrackTintColor="#000000"
                  />
                  <Text style={{ fontSize: 15, fontWeight: "bold", color: tc, fontFamily: "Finlandica", marginTop:6}}>Latency: {settings[mac]?.latency || 100} ms</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={500}
                    step={10}
                    value={settings[mac]?.latency || 100}
                    onSlidingComplete={(value: number) => handleLatencyChange(mac, value)}
                    minimumTrackTintColor="#FF0055"
                    maximumTrackTintColor="#000000"
                  />
                </SafeAreaView>
              ))
            )}
            <Text style={{ fontSize: 15, fontWeight: "bold", color: tc, fontFamily: "Finlandica", marginTop:6, alignSelf:'center', marginBottom:-20}}>
              Adjust the sliders for each speaker as needed.
            </Text>
            <SafeAreaView style={styles.buttonContainer}>
              {configIDParam ? (
                isConnected ? (
                  <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
                    <Text style={styles.buttonText}>Disconnect Configuration</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={{backgroundColor:pc, padding: 15, borderRadius: 8, width: "90%", marginTop: -10 }} onPress={handleConnect}>
                    <Text style={styles.buttonText}>Connect Configuration</Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.buttonText}>Save Configuration</Text>
                </TouchableOpacity>
              )}
              
            </SafeAreaView>
          </ScrollView>
        </YStack>
      );
    }
    
    const styles = StyleSheet.create({
      container: { flex: 1, padding: 20, backgroundColor: '#fff' },
      header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
      speakerContainer: {},
      speakerName: { fontSize: 18, marginBottom: 10 },
      label: { fontSize: 16, marginTop: 10 },
      slider: { width: '100%', height: 40, marginBottom: -5},
      instructions: { fontSize: 14, marginTop: 10, textAlign: 'center' },
      buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30 },
      saveButton: { backgroundColor: '#3E0094', padding: 15, borderRadius: 8 },
      disconnectButton: { backgroundColor: '#3E0094', padding: 15, borderRadius: 8 },
      deleteButton: { backgroundColor: '#FF0055', padding: 15, borderRadius: 8 },
      buttonText: { color: '#fff', fontSize: 16 },
      homeButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#3E0094',
        justifyContent: 'center',
        alignItems: 'center',
      },
      homeButtonText: { color: '#fff', fontSize: 16 },
    });