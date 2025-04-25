import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { YStack, Text, Button, Spinner, ListItem, useThemeName, useTheme } from 'tamagui';
import { useBLEContext } from '../contexts/BLEContext';
import { MESSAGE_TYPES } from '../contexts/BLEContext';

interface SpeakerDevice {
  mac: string;
  name: string;
}

export default function DeviceSelectionScreen() {
  const [loading, setLoading] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<SpeakerDevice[]>([]);
  const { 
    connectedDevice,
    sendMessage,
    pairedDevices
  } = useBLEContext();

  const themeName = useThemeName();
  const theme = useTheme();
  
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF';
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094';
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E';
  const svbg = themeName === 'dark' ? '#350066' : '#F9F5FF';

  // Start scanning and set up polling for device queue
  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout;

    const pollDevices = async () => {
      if (!mounted || !connectedDevice) return;
      
      try {
        // Request list of devices from the Pi
        // Send raw bytes: [0x12, 0x00, 0x00, 0x00, 0x00]
        const buffer = new ArrayBuffer(5);
        const view = new DataView(buffer);
        view.setUint8(0, MESSAGE_TYPES.GET_DEVICES);
        view.setUint32(1, 0, false); // big-endian
        await sendMessage(MESSAGE_TYPES.GET_DEVICES, new Uint8Array(buffer));
      } catch (error) {
        console.error('Error polling devices:', error);
      }
    };

    // Initial poll and set up interval
    if (connectedDevice) {
      pollDevices();
      pollInterval = setInterval(pollDevices, 2000);
    }

    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [connectedDevice, sendMessage]);

  // Update discovered devices when pairedDevices changes
  useEffect(() => {
    if (Array.isArray(pairedDevices)) {
      const formattedDevices = pairedDevices.map(device => ({
        mac: device.id || device.mac,
        name: device.name || 'Unknown Device'
      }));
      setDiscoveredDevices(formattedDevices);
    }
  }, [pairedDevices]);

  const startScanning = async () => {
    if (!connectedDevice) {
      Alert.alert('Error', 'Not connected to Pi. Please connect first.');
      return;
    }

    setLoading(true);
    try {
      // Tell Pi to start scanning - send raw bytes: [0x10, 0x00, 0x00, 0x00, 0x00]
      const startBuffer = new ArrayBuffer(5);
      const startView = new DataView(startBuffer);
      startView.setUint8(0, MESSAGE_TYPES.START_SCAN);
      startView.setUint32(1, 0, false); // big-endian
      await sendMessage(MESSAGE_TYPES.START_SCAN, new Uint8Array(startBuffer));
      
      // Wait for a bit to let the Pi scan
      setTimeout(async () => {
        // Stop scanning - send raw bytes: [0x11, 0x00, 0x00, 0x00, 0x00]
        const stopBuffer = new ArrayBuffer(5);
        const stopView = new DataView(stopBuffer);
        stopView.setUint8(0, MESSAGE_TYPES.STOP_SCAN);
        stopView.setUint32(1, 0, false); // big-endian
        await sendMessage(MESSAGE_TYPES.STOP_SCAN, new Uint8Array(stopBuffer));
        setLoading(false);
      }, 5000);
    } catch (error) {
      console.error('Error during scan:', error);
      Alert.alert('Error', 'Failed to scan for devices');
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} padding="$4" space="$4">
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Available Speakers</Text>
      
      <Button
        onPress={startScanning}
        disabled={loading || !connectedDevice}
        pressStyle={{ opacity: 0.8 }}
      >
        {loading ? <Spinner /> : 'Scan for Speakers'}
      </Button>

      <YStack space="$2">
        {discoveredDevices.map((device) => (
          <ListItem
            key={device.mac}
            title={device.name}
            subTitle={device.mac}
            disabled={loading}
          />
        ))}
      </YStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20
  }
});