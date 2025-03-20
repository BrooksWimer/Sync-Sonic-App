import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSearchParams } from 'expo-router/build/hooks';

const PI_API_URL = 'http://10.0.0.89:3000';

export default function SpeakerConfigScreen() {
  // Retrieve the 'speakers' parameter from the URL
  const params = useSearchParams();
  const speakersStr = params.get('speakers'); // This is a JSON string or null
  
  let connectedSpeakers: { [mac: string]: string } = {};
  try {
    connectedSpeakers = speakersStr ? JSON.parse(speakersStr) : {};
  } catch (e) {
    console.error("Error parsing speakers param:", e);
  }

  // For each speaker, maintain its volume and latency state.
  const initialSettings: { [mac: string]: { volume: number; latency: number } } = {};
  Object.keys(connectedSpeakers).forEach(mac => {
    initialSettings[mac] = { volume: 50, latency: 100 }; // defaults
  });
  const [settings, setSettings] = useState(initialSettings);

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
  };

  const handleLatencyChange = (mac: string, newLatency: number) => {
    setSettings(prev => ({ ...prev, [mac]: { ...prev[mac], latency: newLatency } }));
    adjustLatency(mac, newLatency);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Speaker Configuration</Text>
      {Object.keys(connectedSpeakers).length === 0 ? (
        <Text>No connected speakers found.</Text>
      ) : (
        Object.keys(connectedSpeakers).map(mac => (
          <View key={mac} style={styles.speakerContainer}>
            <Text style={styles.speakerName}>{connectedSpeakers[mac]}</Text>
            <Text style={styles.label}>Volume: {settings[mac].volume}%</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={settings[mac].volume}
              onValueChange={(value: number) => handleVolumeChange(mac, value)}
              minimumTrackTintColor="#FF0055"
              maximumTrackTintColor="#000000"
            />
            <Text style={styles.label}>Latency: {settings[mac].latency} ms</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={500}
              step={10}
              value={settings[mac].latency}
              onValueChange={(value: number) => handleLatencyChange(mac, value)}
              minimumTrackTintColor="#FF0055"
              maximumTrackTintColor="#000000"
            />
          </View>
        ))
      )}
      <Text style={styles.instructions}>Adjust the sliders for each speaker as needed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  speakerContainer: { marginBottom: 30, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  speakerName: { fontSize: 18, marginBottom: 10 },
  label: { fontSize: 16, marginTop: 10 },
  slider: { width: '100%', height: 40 },
  instructions: { fontSize: 14, marginTop: 10, textAlign: 'center' }
});
