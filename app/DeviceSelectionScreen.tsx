import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSearchParams } from 'expo-router/build/hooks';
import { 
  addConfiguration, 
  updateConnectionStatus, // NEW: update connection status in the DB
  addSpeaker 
} from './database';
import { useTheme, useThemeName } from 'tamagui';
import { TopBar } from '@/components/TopBar';

const PI_API_URL = 'http://10.0.0.89:3000'; // Your Pi's API URL

export default function DeviceSelectionScreen() {
  const params = useSearchParams();
  const configName = params.get('configName') || 'Unnamed Configuration';  // config name passed in
  const configIDParam = params.get('configID'); // might be undefined if new
  const [devices, setDevices] = useState<{ mac: string, name: string }[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<{ [mac: string]: { mac: string, name: string } }>({});
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const router = useRouter();

  // Fetch devices from your Pi's API
  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${PI_API_URL}/scan`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      // data.devices is an object { "MAC": "DisplayName", ... }
      const deviceArray = Object.keys(data.devices).map(mac => ({ mac, name: data.devices[mac] }));
      setDevices(deviceArray);
    } catch (error) {
      console.error('Error fetching devices:', error);
      Alert.alert('Error', 'Could not scan for devices on the Pi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // Toggle selection of a device.
  const toggleSelection = (device: { mac: string; name: string }) => {
    setSelectedDevices(prev => {
      const newSelection = { ...prev };
      if (newSelection[device.mac]) {
        delete newSelection[device.mac];
      } else {
        // Allow a maximum of three devices.
        if (Object.keys(newSelection).length >= 3) {
          Alert.alert('Selection Limit', 'You can select up to 3 devices.');
          return prev;
        }
        newSelection[device.mac] = device;
      }
      return newSelection;
    });
  };

  // Render each device as a clickable item.
  const renderItem = ({ item }: { item: { mac: string, name: string } }) => {
    const isSelected = selectedDevices[item.mac] !== undefined;
    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item)}
        style={{
          padding: 16,
          backgroundColor: isSelected ? '#ddd' : '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#ccc'
        }}
      >
        <Text style={{ fontSize: 18 }}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // Pair the selected devices by sending them to your Pi's /pair endpoint.
  const pairSelectedDevices = async () => {
    if (Object.keys(selectedDevices).length === 0) {
      Alert.alert('No Devices Selected', 'Please select at least one device to pair.');
      return;
    }
    setPairing(true);
    try {
      const payload = {
        devices: Object.values(selectedDevices).reduce((acc, device) => {
          acc[device.mac] = device.name;
          return acc;
        }, {} as { [mac: string]: string })
      };

      const response = await fetch(`${PI_API_URL}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const result = await response.json();
      console.log('Pairing result:', result);
      Alert.alert('Pairing Complete', 'Devices have been paired.');

      // Update the database to mark the configuration as connected.
      if (configIDParam) {
        // If the configuration already exists, update its connection status.
        updateConnectionStatus(Number(configIDParam), 1);
        // Also add the speakers to the configuration.
        Object.entries(payload.devices).forEach(([mac, name]) => {
          addSpeaker(Number(configIDParam), name, mac);
        });
        // Navigate to the speaker configuration screen with configID.
        router.push({
          pathname: '/SpeakerConfigScreen',
          params: { 
            speakers: JSON.stringify(payload.devices), 
            configName: configName,
            configID: configIDParam 
          }
        });
      } else {
        // If this is a new configuration, create it and mark as connected.
        addConfiguration(configName, (newConfigID: number) => {
          Object.entries(payload.devices).forEach(([mac, name]) => {
            addSpeaker(newConfigID, name, mac);
          });
          // Now update the connection status.
          updateConnectionStatus(newConfigID, 1);
          // Navigate to the speaker configuration screen with the new configID.
          router.push({
            pathname: '/SpeakerConfigScreen',
            params: { 
              speakers: JSON.stringify(payload.devices), 
              configName: configName,
              configID: newConfigID.toString()
            }
          });
        });
      }
    } catch (error) {
      console.error('Error during pairing:', error);
      Alert.alert('Pairing Error', 'There was an error pairing the devices.');
    } finally {
      setPairing(false);
    }
  };

  const themeName = useThemeName();
          const theme = useTheme();
        
        
          //const imageSource = themeName === 'dark'
            //? require('../assets/images/welcomeGraphicDark.png')
            //: require('../assets/images/welcomeGraphicLight.png')
        
          const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
          const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
          const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
          const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'

  return (
    <View style={{ flex: 1, padding: 0, backgroundColor: bg }}>
      <TopBar/>
      <Text style={{ fontSize: 24, marginBottom: 10, marginTop: 20, marginLeft: 10, color: tc, fontFamily:'Finlandica'}}>Select Speakers</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#FF0055" />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.mac}
          renderItem={renderItem}
          ListEmptyComponent={<Text>No devices found.</Text>}
        />
      )}
      <TouchableOpacity
        onPress={pairSelectedDevices}
        style={{
          alignSelf: 'center',
          width: "90%",
          backgroundColor: '#FF0055',
          padding: 16,
          borderRadius: 8,
          marginTop: 20,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18 }}>Pair Selected Devices</Text>
      </TouchableOpacity>
      {pairing && (
        <ActivityIndicator size="large" color="#FF0055" style={{ marginTop: 20 }} />
      )}
    </View>
  );
}
