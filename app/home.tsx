import React, { useState, useEffect } from 'react';
import { Button, H1, YStack, View, XStack, ScrollView, Text } from "tamagui";
import { ActivityIndicator } from 'react-native';
import { Plus, Pencil } from '@tamagui/lucide-icons';
import { Image, Alert } from "react-native";
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getConfigurations } from './database'; // Import your function to fetch configurations

const PI_API_URL = 'http://10.0.0.89:3000'; // Replace with your Pi's IP and port

export default function Home() {
  const router = useRouter(); // page changing
  const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number }[]>([]);
  const [piDevices, setPiDevices] = useState<{ [mac: string]: string }>({});
  const [scanning, setScanning] = useState(false);
  const [pairingInProgress, setPairingInProgress] = useState(false);

  // Fetch configurations from the database when the component mounts.
  useEffect(() => {
    const configs = getConfigurations();
    setConfigurations(configs);
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
    // Start scanning by calling the API.
    await scanForDevices();
    // After scanning, show the available devices in an alert for now.
    // In a real app, you would display a proper selection UI.
    const deviceEntries = Object.entries(piDevices);
    if (deviceEntries.length === 0) {
      Alert.alert('No Devices', 'No speakers were discovered on the Pi.');
      return;
    }
    // For demonstration, we auto-select all discovered devices.
    // You can replace this with a proper selection UI.
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
    // Call resetDatabase() if available.
    console.log("Database Reset");
    router.replace('/home');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "$bg" }}>
      {/* Top Bar */}
      <View style={{
          height: 80,
          backgroundColor: "#3E0094",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 20
      }}>
        <Image
          source={require("@/assets/images/horizontalPinkLogo.png")}
          style={{ width: 100, height: 40, resizeMode: "contain" }}
        />
      </View>

      {/* Header */}
      <View style={{
          paddingTop: 20,
          paddingBottom: 10,
          alignItems: "center",
      }}>
        <H1 style={{ fontSize: 32, fontWeight: "bold" }}>Configurations</H1>
      </View>

      {/* Main Content: Display saved configurations */}
      <ScrollView style={{ paddingHorizontal: 20 }}>
        {configurations.length === 0 ? (
          <H1 style={{ textAlign: "center", color: "#666", marginVertical: 10 }}>
            No configurations found.
          </H1>
        ) : (
          configurations.map((config) => (
            // Wrapping each configuration in a touchable container allows navigation when clicked.
            <XStack 
              key={config.id} 
              alignItems="center"
              // backgroundColor="#1B1B1B"
              borderRadius={15}
              padding={15}
              marginBottom={10}
              borderWidth={1}
              borderColor="#3E0094"
              justifyContent="space-between"
              shadowColor="#93C7FF"
              shadowOffset={{ width: 0, height: 0 }}
              shadowOpacity={0.8}
              shadowRadius={8}
              hoverStyle={{
                shadowRadius: 15,
                shadowOpacity: 1,
                transform: [{ scale: 1.02 }]
              }}
              pressStyle={{
                shadowRadius: 20,
                transform: [{ scale: 1.04 }]
              }}
              onPress={() => router.push({
                pathname: "/SpeakerConfigScreen",
                params: { configID: config.id.toString(), configName: config.name }
              })}
            >
              <YStack>
                <H1 color="#FFFFF" style={{ fontSize: 18 }}>{config.name}</H1>
                <H1 style={{ fontSize: 14, color: "#1B1B1B" }}> x {config.speakerCount} speakers</H1>
              </YStack>
              <Button
                icon={<Pencil size={20} />}
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
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 15,
          backgroundColor: '#FF0055',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
      
      {/* Loading Indicators */}
      {scanning && (
        <View style={{ position: 'absolute', top: 100, alignSelf: 'center' }}>
          <ActivityIndicator size="large" color="#FF0055" />
          <Text>Scanning for devices...</Text>
        </View>
      )}
      {pairingInProgress && (
        <View style={{ position: 'absolute', top: 150, alignSelf: 'center' }}>
          <ActivityIndicator size="large" color="#FF0055" />
          <Text>Pairing devices...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
