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

// const PI_API_URL = 'http://10.193.147.160:3000';
const PI_API_URL = "http://10.0.0.89:3000"

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.header}>
          Speaker Configuration: {configNameParam}
        </Text>
        {Object.keys(connectedSpeakers).length === 0 ? (
          <Text>No connected speakers found.</Text>
        ) : (
          Object.keys(connectedSpeakers).map(mac => (
            <SafeAreaView key={mac} style={styles.speakerContainer}>
              <View style={styles.speakerHeader}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: settings[mac]?.isConnected ? '#00FF6A' : '#FF0055' }
                  ]}
                />
                <Text style={styles.speakerName}>{connectedSpeakers[mac]}</Text>
              </View>
              <Text style={styles.label}>Volume: {settings[mac]?.volume || 50}%</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={settings[mac]?.volume || 50}
                onValueChange={(value: number) => handleVolumeChange(mac, value)}
                minimumTrackTintColor="#FF0055"
                maximumTrackTintColor="#000000"
              />
              <Text style={styles.label}>Latency: {settings[mac]?.latency || 100} ms</Text>
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

        <TouchableOpacity 
          style={[styles.checkButton, isCheckingPort && styles.disabledButton]} 
          onPress={handleCheckPort}
          disabled={isCheckingPort}
        >
          {isCheckingPort ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkButtonText}>Connect Your Phone Here</Text>
          )}
        </TouchableOpacity>
        {freeController && (
          <Text style={styles.phoneInstruction}>
            Connect phone to <Text style={styles.highlight}>{freeController}</Text>
          </Text>
        )}
        <SafeAreaView style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.disconnectButton, isDisconnecting && styles.disabledButton]} 
            onPress={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Disconnect</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.saveButton, isConnecting && styles.disabledButton]} 
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.deleteButton, isDeleting && styles.disabledButton]} 
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </ScrollView>
      <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/home')}>
        <Text style={styles.homeButtonText}>Home</Text>
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
    textAlign: 'center',
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  speakerContainer: { 
    marginBottom: 30, 
    padding: 20, 
    backgroundColor: '#9D9D9D',
    borderRadius: 15,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  speakerName: { 
    fontSize: 24, 
    marginLeft: 10,
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  label: { 
    fontSize: 16, 
    marginTop: 10,
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  slider: { 
    width: '100%', 
    height: 40,
    marginVertical: 10
  },
  instructions: { 
    fontSize: 16, 
    marginTop: 10, 
    textAlign: 'center',
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  phoneInstruction: { 
    fontSize: 18, 
    marginTop: 20, 
    textAlign: 'center',
    color: '#26004E',
    fontFamily: "Finlandica"
  },
  highlight: { 
    fontWeight: 'bold', 
    color: '#3E0094',
    fontFamily: "Finlandica"
  },
  checkButton: {
    backgroundColor: '#3E0094',
    padding: 15,
    marginVertical: 10,
    borderRadius: 15,
    alignSelf: 'center',
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  checkButtonText: { 
    color: '#F2E8FF', 
    fontSize: 18,
    fontFamily: "Finlandica"
  },
  buttonContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 30,
    gap: 8
  },
  saveButton: { 
    backgroundColor: '#3E0094', 
    padding: 12, 
    borderRadius: 15,
    flex: 1,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  disconnectButton: { 
    backgroundColor: '#3E0094', 
    padding: 12, 
    borderRadius: 15,
    flex: 1,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  deleteButton: { 
    backgroundColor: '#FF0055', 
    padding: 12, 
    borderRadius: 15,
    flex: 1,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  buttonText: { 
    color: '#F2E8FF', 
    fontSize: 14,
    fontFamily: "Finlandica",
    textAlign: 'center'
  },
  homeButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#3E0094',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
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