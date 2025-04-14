import React, { useState, useEffect, useCallback } from 'react';
import { Button, H1, YStack, View, XStack, ScrollView, Text, useThemeName, useTheme } from "tamagui";
import { ActivityIndicator, Pressable, StatusBar } from 'react-native';
import { Plus, Pencil } from '@tamagui/lucide-icons';
import { Image, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteConfiguration, getConfigurations, getSpeakersFull } from './database';
import { TopBar } from '@/components/TopBar';
import { AddButton } from '@/components/AddButton'
import {PI_API_URL} from '../utils/consts'


export default function Home() {
  const router = useRouter(); // page changing
  const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number, isConnected: number }[]>([]);
  const [speakerStatuses, setSpeakerStatuses] = useState<{ [key: number]: boolean[] }>({});
  const [piDevices, setPiDevices] = useState<{ [mac: string]: string }>({});
  const [scanning, setScanning] = useState(false);
  const [pairingInProgress, setPairingInProgress] = useState(false);


  // Get status bar height for proper positioning
  const statusBarHeight = StatusBar.currentHeight || 0;
  // Make the top bar larger to accommodate the status bar
  const topBarHeight = 120 + statusBarHeight;

  // Fetch configurations and their speaker statuses
 
useFocusEffect(
  useCallback(() => {
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
  }, [])
);

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
    router.push('/settings/config');
    console.log("creating new configuration . . .");
  };

  const clearDatabase = () => {
    console.log("Database Reset");
    router.replace('/home');
  };

  const handleDeleteConfig = (id: number) => {
    Alert.alert(
      'Delete Configuration',
      'Are you sure you want to delete this configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteConfiguration(id)
            setConfigurations(prev => prev.filter(c => c.id !== id))
          }
        }
      ]
    )
  }
  

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
      {/* Top Bar */}
      <TopBar/>      

      {/* Header */}
      <View style={{
          paddingTop: 20,
          paddingBottom: 10,
          alignItems: "center",
          backgroundColor: bg
      }}>
        <H1
          style={{ color: tc }}
          fontFamily="Finlandica"
          fontSize={36}
          lineHeight={44}
          fontWeight="700"
          marginBottom={20}
          marginTop={15}
          >
          Configurations
          </H1>
      </View>

      {/* Main Content: Display saved configurations */}
      <ScrollView style={{ paddingHorizontal: 20 }}>
        {configurations.length === 0 ? (
          <H1 style={{ textAlign: "center", color: stc, fontFamily: "Finlandica", marginVertical: 10 }}>
            No configurations found.
          </H1>
        ) : (
          configurations.map((config) => (
            // Touching the configuration takes you to the SpeakerConfigScreen
            <Pressable
            key={config.id}
            onLongPress={() => handleDeleteConfig(config.id)}
            delayLongPress={600}
          >
            <XStack
              alignItems="center"
              borderRadius={15}
              padding={15}
              marginBottom={10}
              borderWidth={1}
              borderColor={stc}
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
              onLongPress={() => handleDeleteConfig(config.id)}
              >
              <YStack>
                <H1 style={{ fontSize: 18, color: tc, fontWeight: "bold", fontFamily: "Finlandica"}}>{config.name}</H1>

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

                {/* Connection status */}
                <H1 style={{ fontSize: 14, color: config.isConnected ? "#00FF6A" : "#FF0055", marginTop: 6 }}>
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
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Plus Button (Floating) */}
      <AddButton onPress={addConfig} />
      
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
    </YStack>
  );
}

const styles = StyleSheet.create({
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  }
});
