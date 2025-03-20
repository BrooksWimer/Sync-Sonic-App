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

const PI_API_URL = 'http://10.0.0.89:3000'; // Your Pi's API URL

export default function DeviceSelectionScreen() {
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
      // For each selected device, we'll use a fixed controller for now.
      // In a more advanced version, you might allow the user to choose.
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
      // Optionally navigate to a different screen (e.g., a control page)
      router.push({ pathname: '/SpeakerConfigScreen', params: { speakers: JSON.stringify(payload.devices) } });

    } catch (error) {
      console.error('Error during pairing:', error);
      Alert.alert('Pairing Error', 'There was an error pairing the devices.');
    } finally {
      setPairing(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 10 }}>Select Speakers</Text>
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
