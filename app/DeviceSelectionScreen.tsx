import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  create_configuration,
} from '@/utils/database';
import { H1, useThemeName, YStack, View } from 'tamagui';
import { useBLEContext } from '../contexts/BLEContext';
import { BottomButton } from '@/components/BottomButton';
import {
  startScanDevices,
  stopScanDevices,
  fetchPairedDevices
} from '../utils/ble_functions';
import { TopBar } from '@/components/TopBar';
import { Body } from '@/components/BodyText';
import { Header } from '@/components/TitleText';

type SpeakerDevice = {
  mac: string;
  name: string;
  paired?: boolean;
};

export default function DeviceSelectionScreen() {
  const params = useLocalSearchParams<{ configID: string; configName: string }>();
  const configName = params.configName || 'Unnamed Configuration';
  const configID = Number(params.configID);

  const themeName = useThemeName();
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF';
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094';
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E';
  const svbg = themeName === 'dark' ? '#350066' : '#F9F5FF';

  const {
    connectedDevice,
    ensurePiNotifications,
    handleNotification,
    scannedDevices,
    pairedDevices
  } = useBLEContext();

  const [scanLoading, setScanLoading] = useState(true);
  const [pairedLoading, setPairedLoading] = useState(true);
  const [selectedScanned, setSelectedScanned] = useState<Record<string, SpeakerDevice>>({});
  const [selectedSaved, setSelectedSaved] = useState<Record<string, SpeakerDevice>>({});
  const [scanError, setScanError] = useState<string | null>(null);
  const [pairedError, setPairedError] = useState<string | null>(null);

  const router = useRouter();

  // Start scan on mount; stop on unmount
  const startScanning = useCallback(async () => {
    if (!connectedDevice) return;
    
    setScanLoading(true);
    setScanError(null);
    
    try {
      console.log("Starting scan for devices...");
      await startScanDevices(connectedDevice);
    } catch (e) {
      console.error('Failed to start scan', e);
      setScanError('Could not start speaker scan');
    }
  }, [connectedDevice]);

  // Fetch paired devices
  const fetchPairedDevicesFromPi = useCallback(async () => {
    if (!connectedDevice) return;
    
    setPairedLoading(true);
    setPairedError(null);
    
    try {
      console.log("Fetching paired devices...");
      // Fire-and-forget – actual list comes via SUCCESS notification
      await fetchPairedDevices(connectedDevice);
    } catch (error) {
      console.error('Failed to fetch paired devices:', error);
      setPairedError('Could not fetch paired devices');
    } finally {
      setPairedLoading(false);
    }
  }, [connectedDevice]);

  // Setup notification handler and initialize
  useEffect(() => {
    if (!connectedDevice) return;
    
    (async () => {
      try {
        // Setup notifications first
        await ensurePiNotifications(connectedDevice, handleNotification);
        
        // Then start both operations
        await startScanning();
        await fetchPairedDevicesFromPi();
      } catch (e) {
        console.error('Setup error:', e);
        Alert.alert('Error', 'Could not set up device communication');
      }
    })();
    
    return () => {
      if (connectedDevice) {
        stopScanDevices(connectedDevice).catch(e => 
          console.error('Error stopping scan on unmount:', e)
        );
      }
    };
  }, [connectedDevice]);

  // When the first notification arrives, stop waiting for scan
  useEffect(() => {
    if (scannedDevices && scannedDevices.length > 0 && scanLoading) {
      setScanLoading(false);
    }
  }, [scannedDevices, scanLoading]);

  // Stop paired loading when context updates
  useEffect(() => {
    if (pairedLoading && pairedDevices.length >= 0) {
      setPairedLoading(false);
    }
  }, [pairedDevices, pairedLoading]);

  const toggleScanned = (d: SpeakerDevice) =>
    setSelectedScanned(prev => {
      const copy = { ...prev };
      if (copy[d.mac]) delete copy[d.mac];
      else copy[d.mac] = d;
      return copy;
    });

  const toggleSaved = (d: SpeakerDevice) =>
    setSelectedSaved(prev => {
      const copy = { ...prev };
      if (copy[d.mac]) delete copy[d.mac];
      else copy[d.mac] = d;
      return copy;
    });

  const handleCreate = async () => {
    // stop scan immediately
    if (connectedDevice) {
      await stopScanDevices(connectedDevice);
    }
    const combined = [
      ...Object.values(selectedScanned),
      ...Object.values(selectedSaved)
    ];
    if (combined.length === 0) {
      Alert.alert('No speakers', 'Please select at least one speaker.');
      return;
    }
    const newId = create_configuration(configName, combined);
    router.push({ pathname: '/SpeakerConfigScreen', params: { configID: newId.toString(), configName } });
  };

  const renderItem = (item: SpeakerDevice, selectedMap: Record<string, any>, toggle: (d: SpeakerDevice) => void) => {
    const isSel = Boolean(selectedMap[item.mac]);
    return (
      <TouchableOpacity
        onPress={() => toggle(item)}
        style={[styles.deviceItem, { shadowColor: tc, borderColor: tc }, isSel && { backgroundColor: pc }]}
      >
        <Text style={[styles.deviceName, isSel && styles.selectedText]}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <YStack style={{ flex: 1, backgroundColor: bg }}>
      <TopBar />
      <Header title={"Select Speaker"}/>

      <View style={{ padding: 10, alignItems: 'center' }}>
        <H1 style={{ color: tc, fontFamily: 'Finlandica', fontSize: 18 }}>Available Speakers</H1>
      </View>

      <FlatList
      data={scannedDevices}
      keyExtractor={(d: SpeakerDevice) => d.mac}
      renderItem={({ item }: { item: SpeakerDevice }) => renderItem(item, selectedScanned, toggleScanned)}
      ListEmptyComponent={
        scanLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={pc} />
          </View>
        ) : scanError ? (
          <Text style={{ color: 'red', textAlign: 'center', padding: 10 }}>{scanError}</Text>
        ) : (
          <Text style={{ textAlign: 'center', padding: 10 }}>No devices found</Text>
        )
      }
      style={[styles.list, { backgroundColor: svbg, borderColor: tc }]}
    />

      <View style={{ padding: 10, alignItems: 'center' }}>
        <H1 style={{ color: tc, fontFamily: 'Finlandica', fontSize: 18 }}>Paired Speakers</H1>
      </View>

      {pairedLoading ? (
      <ActivityIndicator size="large" color={pc} />
    ) : pairedError ? (
      <View style={{ padding: 10, alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>{pairedError}</Text>
      </View>
    ) : (
      <FlatList
        data={pairedDevices}
        keyExtractor={(d: SpeakerDevice) => d.mac}
        renderItem={({ item }: { item: SpeakerDevice }) => renderItem(item, selectedSaved, toggleSaved)}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }}>
            <Body>No paired speakers found</Body>
          </View>
        }
        style={[styles.list, { backgroundColor: svbg, borderColor: tc }]}
        contentContainerStyle={pairedDevices.length === 0 ? { flexGrow: 1 } : undefined}
      />
    )}


      <BottomButton
        onPress={handleCreate}
        isLoading={pairedLoading}
        disabled={
          Object.keys(selectedScanned).length === 0 &&
          Object.keys(selectedSaved).length === 0
        }
        style={{ marginTop: 30 }}
      >
        <H1
          color="white"
          fontSize={18}
          alignSelf="center"
          fontFamily="Inter-Regular"
          letterSpacing={1}
        >
          Create Configuration
        </H1>
      </BottomButton>
    </YStack>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
    height: Dimensions.get('window').height * 0.3,
    marginHorizontal: '5%',
    borderRadius: 15,
    borderWidth: 1,
    padding: 10,
    marginBottom: 20,
  },
  deviceItem: {
    padding: 16,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  deviceName: {
    fontSize: 18,
    fontFamily: 'Finlandica',
  },
  selectedText: {
    color: 'white',
  },
  button: {
    alignSelf: 'center',
    marginVertical: 20,
    width: '90%',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
  },
});
