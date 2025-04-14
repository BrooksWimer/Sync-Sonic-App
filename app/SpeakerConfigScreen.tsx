import { useSearchParams } from 'expo-router/build/hooks';
import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator, View } from 'react-native';
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
import { useTheme, useThemeName, YStack } from 'tamagui';
import { TopBar } from '@/components/TopBar';
import { 
  handleVolumeChange,
  handleLatencyChange
} from '../utils/SpeakerFunctions';
import { 
  handleDelete, 
  handleDisconnect, 
  handleConnect
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
    const loadData = async () => {
      if (configIDParam) {
        const configIdNum = Number(configIDParam);
        if (isNaN(configIdNum)) {
          console.error("Invalid config ID:", configIDParam);
          return;
        }

        // Use the new getSpeakersFull to load *all* speaker data, including is_connected.
        const fullRows = await getSpeakersFull(configIdNum);

        // Build `connectedSpeakers` and `settings` from these rows.
        const mapping: { [mac: string]: string } = {};
        const loadedSettings: {
          [mac: string]: { volume: number; latency: number; isConnected: boolean };
        } = {};

        if (fullRows) {
          fullRows.forEach(row => {
            mapping[row.mac] = row.name;
            loadedSettings[row.mac] = {
              volume: row.volume,
              latency: row.latency,
              isConnected: row.is_connected
            };
          });
        }

        setConnectedSpeakers(mapping);
        setSettings(loadedSettings);

        // For the overall config status:
        try {
          const status = await getConfigurationStatus(configIdNum);
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
              isConnected: false
            };
          });
          setSettings(defaultSettings);
        } catch (e) {
          console.error("Error parsing speakers param:", e);
          setConnectedSpeakers({});
        }
      }
    };

    loadData();
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
                    onValueChange={(value: number) => handleVolumeChangeWrapper(mac, value, false)}
                    onSlidingComplete={(value: number) => handleVolumeChangeWrapper(mac, value, true)}
                    minimumTrackTintColor="#FF0055"
                    maximumTrackTintColor="#000000"
                  />
                  <Text style={styles.label}>Latency: {settings[mac]?.latency || 100} ms</Text>
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
                  />
                </SafeAreaView>
              ))
            )}
    
            <SafeAreaView style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.disconnectButton, isDisconnecting && styles.disabledButton]} 
                onPress={handleDisconnectWrapper}
                disabled={isDisconnecting || !isConnected}
              >
                {isDisconnecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Disconnect</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, isConnecting && styles.disabledButton]} 
                onPress={handleConnectWrapper}
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
                onPress={() => handleDelete(configIDParam, router)}
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
          <Link 
            href="/home"
            style={styles.homeButton}
            asChild
          >
            <TouchableOpacity>
              <Text style={styles.homeButtonText}>Home</Text>
            </TouchableOpacity>
          </Link>
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
      buttonContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        marginTop: 30,
        gap: 8,
        paddingHorizontal: 20,
        width: '100%'
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
        alignItems: 'center',
        justifyContent: 'center'
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
        alignItems: 'center',
        justifyContent: 'center'
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
        alignItems: 'center',
        justifyContent: 'center'
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