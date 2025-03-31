import { useSearchParams } from 'expo-router/build/hooks';
import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
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
  updateSpeakerSettings 
} from './database';
import { useTheme, useThemeName, YStack } from 'tamagui';
import { TopBar } from '@/components/TopBar';

const PI_API_URL = 'http://10.0.0.89:3000';


  


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
  const [settings, setSettings] = useState<{ [mac: string]: { volume: number; latency: number } }>({});

  // Load speakers either from the database (if configID exists) or from URL.
  useEffect(() => {
    if (configIDParam) {
      // Load speakers from the database.
      const dbRows = getSpeakers(Number(configIDParam));
      const mapping: { [mac: string]: string } = {};
      dbRows.forEach(row => {
        mapping[row.mac] = row.name;
      });
      setConnectedSpeakers(mapping);

      // Fetch connection status from the DB.
      try {
        const status = getConfigurationStatus(Number(configIDParam));
        setIsConnected(status === 1);
      } catch (err) {
        console.error("Error fetching connection status:", err);
      }

      // Fetch saved settings from the DB.
      try {
        const savedSettings = getConfigurationSettings(Number(configIDParam));
        setSettings(savedSettings);
      } catch (err) {
        console.error("Error fetching configuration settings:", err);
        // Fall back to default settings for each speaker.
        const defaultSettings: { [mac: string]: { volume: number; latency: number } } = {};
        Object.keys(mapping).forEach(mac => {
          defaultSettings[mac] = { volume: 50, latency: 100 };
        });
        setSettings(defaultSettings);
      }
    } else {
      // If there's no saved configuration, parse speakers from URL.
      try {
        const spk = speakersStr ? JSON.parse(speakersStr) : {};
        setConnectedSpeakers(spk);
        // Set default settings.
        const defaultSettings: { [mac: string]: { volume: number; latency: number } } = {};
        Object.keys(spk).forEach(mac => {
          defaultSettings[mac] = { volume: 50, latency: 100 };
        });
        setSettings(defaultSettings);
      } catch (e) {
        console.error("Error parsing speakers param:", e);
        setConnectedSpeakers({});
      }
    }
  }, [configIDParam, speakersStr]);

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

  // Handler for "Connect Configuration"
  const handleConnect = async () => {
    if (isConnected) {
      Alert.alert("Already Connected", "This configuration is already connected.");
      return;
    }
    
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
      Alert.alert("Connected", "Configuration connected successfully.");
      
      // Update local database to mark this configuration as connected.
      if (configIDParam) {
        updateConnectionStatus(Number(configIDParam), 1);
      }
      setIsConnected(true);
    } catch (error) {
      console.error("Error connecting configuration:", error);
      Alert.alert("Connection Error", "Failed to connect configuration.");
    }
  };

  // Handler for disconnecting a configuration.
  const handleDisconnect = async () => {
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
      if (configIDParam) {
        updateConnectionStatus(Number(configIDParam), 0);
      }
      setIsConnected(false);
    } catch (error) {
      console.error("Error disconnecting configuration:", error);
      Alert.alert("Disconnection Error", "Failed to disconnect configuration.");
    }
  };

  const handleSave = () => {
    const speakersArray = Object.entries(connectedSpeakers).map(([mac, name]) => ({ mac, name }));
    
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
  };

  const handleDelete = () => {
    if (configIDParam) {
      deleteConfiguration(Number(configIDParam));
    }
    router.replace('/home');
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
                onValueChange={(value: number) => handleVolumeChange(mac, value)}
                minimumTrackTintColor="#FF0055"
                maximumTrackTintColor="#000000"
                thumbTintColor="white"
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
                thumbTintColor="white"
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
  buttonText: { color: '#fff', fontSize: 16, alignSelf: "center" },
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
