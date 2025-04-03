import React, { useState, useEffect } from 'react';
import { Button, H1, YStack, View, XStack, ScrollView, Text, useThemeName, useTheme } from "tamagui";
import { ActivityIndicator } from 'react-native';
import { Plus, Pencil } from '@tamagui/lucide-icons';
import { Image, Alert, StatusBar, StyleSheet, Platform } from "react-native";
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getConfigurations, getSpeakersFull } from './database';

// const PI_API_URL = 'http://10.193.147.160:3000'; // Replace with your Pi's IP and port
const PI_API_URL = "http://10.0.0.89:3000"

export default function Home() {
  const router = useRouter(); // page changing
  const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number, isConnected: number }[]>([]);
  const [speakerStatuses, setSpeakerStatuses] = useState<{ [key: number]: boolean[] }>({});
  const [piDevices, setPiDevices] = useState<{ [mac: string]: string }>({});
  const [scanning, setScanning] = useState(false);
  const [pairingInProgress, setPairingInProgress] = useState(false);

  // Theme support
  const themeName = useThemeName();
  const theme = useTheme();
  
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
  const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'

  // Get status bar height for proper positioning
  const statusBarHeight = StatusBar.currentHeight || 0;
  // Make the top bar larger to accommodate the status bar
  const topBarHeight = 120 + statusBarHeight;

  // Fetch configurations and their speaker statuses
  useEffect(() => {
    const fetchData = async () => {
      try {
        const configs = await getConfigurations();
        setConfigurations(configs);
        
        // Fetch speaker statuses for each configuration
        const statuses: { [key: number]: boolean[] } = {};
        for (const config of configs) {
          const speakers = getSpeakersFull(config.id);
          statuses[config.id] = speakers.map(speaker => speaker.is_connected === 1);
        }
        setSpeakerStatuses(statuses);
      } catch (error) {
        console.error('Error fetching configurations:', error);
      }
    };
    
    fetchData();
  }, []);

  // Function to call the /scan endpoint on your Pi.
  const scanForDevices = async () => {
    try {
      setScanning(true);
      const response = await fetch(`${PI_API_URL}/scan`);
      if (!response.ok) {
        throw new Error(`Scan error: ${response.status}`);
      }
      const data = await response.json();
      console.log('Scan data:', data);
      // data.devices should be an object mapping MAC addresses to display names.
      setPiDevices(data.devices);
    } catch (error) {
      console.error('Error scanning for devices:', error);
      Alert.alert('Scan Error', 'Could not scan for devices on the Pi.');
    } finally {
      setScanning(false);
    }
  };

  // Function to pair selected devices.
  const pairDevices = async (selected: { [mac: string]: string }) => {
    try {
      setPairingInProgress(true);
      // Construct an array of objects, each with a mac and a chosen controller.
      // For simplicity, we assign a fixed controller for now.
      const devices = Object.keys(selected).map(mac => ({
        mac,
        ctrl: '2C:CF-67-CE-57-91' // you might allow user to choose or auto-assign controllers
      }));
      const response = await fetch(`${PI_API_URL}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices })
      });
      if (!response.ok) {
        throw new Error(`Pair error: ${response.status}`);
      }
      const result = await response.json();
      console.log('Pairing result:', result);
      Alert.alert('Pairing Result', JSON.stringify(result));
    } catch (error) {
      console.error('Error during pairing:', error);
      Alert.alert('Pairing Error', 'Could not pair devices on the Pi.');
    } finally {
      setPairingInProgress(false);
    }
  };

  // Handler for when the Connect button is pressed.
  const onConnectPress = async () => {
    await scanForDevices();
    const deviceEntries = Object.entries(piDevices);
    if (deviceEntries.length === 0) {
      Alert.alert('No Devices', 'No speakers were discovered on the Pi.');
      return;
    }
    Alert.alert(
      'Devices Found',
      deviceEntries.map(([mac, name]) => `${name} (${mac})`).join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pair All', onPress: () => pairDevices(piDevices) }
      ]
    );
  };

  // Function to navigate to create a new configuration.
  const addConfig = () => {
    router.replace('/settings/config');
    console.log("creating new configuration . . .");
  };

  const clearDatabase = () => {
    console.log("Database Reset");
    router.replace('/home');
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Top bar that extends to the top of the screen */}
      <View style={[styles.topBar, { 
        backgroundColor: pc,
        height: topBarHeight,
      }]}>
        {/* Position the logo at the bottom of the top bar */}
        <View style={[styles.logoContainer, { 
          position: 'absolute',
          bottom: 10,
          width: '100%'
        }]}>
          <Image
            source={require("@/assets/images/horizontalPinkLogo.png")}
            style={styles.topLogo}
          />
        </View>
      </View>

      {/* Main content with SafeAreaView */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <H1 style={[styles.headerText, { color: tc }]}>Configurations</H1>
        </View>

        {/* Main Content: Display saved configurations */}
        <ScrollView style={styles.scrollView}>
          {configurations.length === 0 ? (
            <H1 style={[styles.emptyText, { color: stc }]}>
              No configurations found.
            </H1>
          ) : (
            configurations.map((config) => (
              // Touching the configuration takes you to the SpeakerConfigScreen
              <XStack 
                key={config.id} 
                style={[styles.configCard, { borderColor: stc }]}
                alignItems="center"
                justifyContent="space-between"
                onPress={() => router.push({
                  pathname: "/SpeakerConfigScreen",
                  params: { configID: config.id.toString(), configName: config.name }
                })}
              >
                <YStack>
                  <H1 style={[styles.configName, { color: tc }]}>{config.name}</H1>
                  
                  {/* Speaker dots */}
                  <XStack marginTop={4}>
                    {Array.from({ length: config.speakerCount }).map((_, i) => (
                      <View
                        key={i}
                        style={[styles.statusDot, {
                          backgroundColor: speakerStatuses[config.id]?.[i] ? '#00FF6A' : '#FF0055'
                        }]}
                      />
                    ))}
                  </XStack>

                  <H1 style={[styles.connectionStatus, { 
                    color: config.isConnected ? pc : "#FF0055" 
                  }]}>
                    {config.isConnected ? "Connected" : "Not Connected"}
                  </H1>
                </YStack>
                <Button
                  icon={<Pencil size={20} color={tc}/>}
                  backgroundColor="transparent"
                  onPress={() => router.push({
                    pathname: "/settings/config",
                    params: { configID: config.id.toString(), configName: config.name }
                  })}
                />
              </XStack>
            ))
          )}
        </ScrollView>

        {/* Plus Button (Floating) */}
        <Button
          icon={Plus}
          onPress={addConfig}
          style={[styles.addButton, { backgroundColor: pc }]}
        />
        
        {/* Loading Indicators */}
        {scanning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={pc} />
            <Text style={[styles.loadingText, { color: tc }]}>Scanning for devices...</Text>
          </View>
        )}
        {pairingInProgress && (
          <View style={[styles.loadingContainer, { top: 150 }]}>
            <ActivityIndicator size="large" color={pc} />
            <Text style={[styles.loadingText, { color: tc }]}>Pairing devices...</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    width: '100%',
    justifyContent: "flex-start",
    alignItems: "center",
    zIndex: 10,
  },
  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  topLogo: {
    width: 120,
    height: 50,
    resizeMode: "contain"
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
  },
  headerText: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Finlandica"
  },
  scrollView: {
    paddingHorizontal: 20
  },
  configCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  configName: {
    fontSize: 18,
    fontFamily: "Finlandica"
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  connectionStatus: {
    fontSize: 14,
    marginTop: 6,
    fontFamily: "Finlandica"
  },
  emptyText: {
    textAlign: "center",
    marginVertical: 10,
    fontFamily: "Finlandica"
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
  },
  loadingText: {
    fontFamily: "Finlandica"
  }
});
