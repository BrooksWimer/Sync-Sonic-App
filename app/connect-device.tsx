import { useState, useEffect, useCallback } from "react"
import { YStack, Text, Button, H1, useThemeName, useTheme, XStack } from "tamagui"
import { TouchableOpacity, FlatList, ActivityIndicator, Alert, View, StyleSheet } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { useBLEContext } from "../contexts/BLEContext"
import { Device } from "react-native-ble-plx"
import { TopBar } from "../components/TopBar"
import LottieView from "lottie-react-native"
import { Loader } from '../components/Loader';



const SignalStrengthIndicator = ({ rssi }: { rssi: number }) => {
  // Convert RSSI to a 0-4 scale (4 being best signal)
  const getSignalLevel = (rssi: number) => {
    if (rssi >= -50) return 4; // Excellent
    if (rssi >= -65) return 3; // Good
    if (rssi >= -75) return 2; // Fair
    if (rssi >= -85) return 1; // Poor
    return 0; // Very poor
  };

  const getSignalColor = (rssi: number) => {
    if (rssi >= -65) return '#4CAF50'; // Green for good
    if (rssi >= -75) return '#FFC107'; // Yellow for fair
    return '#F44336'; // Red for poor
  };

  const signalLevel = getSignalLevel(rssi);
  const color = getSignalColor(rssi);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[...Array(4)].map((_, index) => (
        <View
          key={index}
          style={{
            width: 4,
            height: 12,
            backgroundColor: index < signalLevel ? color : '#E0E0E0',
            marginRight: 2,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
};

export default function ConnectDevice() {
  const {
    allDevices,
    isScanning,
    scanForPeripherals,
    stopScan,
    connectToDevice
  } = useBLEContext()
  const [loading, setLoading] = useState(false);
  
  const themeName = useThemeName();

  // when this screen comes into focus, start scanning; when it loses focus, stop
  useEffect(() => {
    console.log("Starting BLE scan (mount)")
    scanForPeripherals()
  
    return () => {
      console.log("Stopping BLE scan (unmount)")
      stopScan()
    }
  }, [])  // <-- empty deps so it only runs once


  const handleScanPress = async () => {
    if (isScanning) {
      await stopScan()
    } else {
      await scanForPeripherals()
    }
  }

  const handleDeviceSelect = async (device: Device) => {
    try {
      setLoading(true)
      console.log('Attempting to connect to device:', {
        id: device.id,
        name: device.name,
        rssi: device.rssi,
        mtu: device.mtu
      })
      
      await connectToDevice(device)
      router.replace('/home')
    } catch (error: any) {
      console.error('Failed to connect:', {
        error: error,
        message: error?.message,
        code: error?.errorCode,
        reason: error?.reason
      })
      Alert.alert('Connection Error', `Failed to connect to the selected device. Error: ${error?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const renderDevice = ({ item }: { item: Device }) => (
    <TouchableOpacity
      onPress={() => handleDeviceSelect(item)}
      style={[
        styles.deviceItem,
        {
          shadowColor: themeName === 'dark' ? '#F2E8FF' : '#26004E',
          borderColor: themeName === 'dark' ? '#F2E8FF' : '#26004E',
        }
      ]}
    >
      <XStack justifyContent="space-between" alignItems="center" width="100%">
        <Text style={[styles.deviceName, { color: themeName === 'dark' ? '#F2E8FF' : '#26004E' }]}>
          {item.name}
        </Text>
        <XStack alignItems="center" gap={8}>
          <SignalStrengthIndicator rssi={item.rssi || -100} />
          <Text style={[styles.signalText, { color: themeName === 'dark' ? '#999' : '#666' }]}>
            Signal Strength
          </Text>
        </XStack>
      </XStack>
    </TouchableOpacity>
  )

  return (
    <YStack
      flex={1}
      style={{ backgroundColor: themeName === 'dark' ? '#250047' : '#F2E8FF' }}
      justifyContent="space-between"
    >
      <TopBar/>

      <YStack flex={1} paddingBottom="$4" space="$4" marginTop="$4">
        <H1
          style={{ color: themeName === 'dark' ? '#F2E8FF' : '#26004E', fontFamily: "Finlandica" }}
          fontSize={36}
          lineHeight={44}
          fontWeight="700"
          letterSpacing={1}
          alignSelf="center"
        >
          Connect Device
        </H1>

        <Text
          style={{ color: themeName === 'dark' ? '#F2E8FF' : '#26004E', fontFamily: "Finlandica" }}
          fontSize={16}
          textAlign="center"
          marginBottom={32}
        >
          Select your Sync-Sonic device from the list below
        </Text>

        <FlatList
          data={allDevices}
          keyExtractor={(item: Device) => item.id}
          renderItem={renderDevice}
          ListEmptyComponent={
            <Text 
              style={{ 
                textAlign: 'center', 
                marginTop: 10,
                color: themeName === 'dark' ? '#F2E8FF' : '#26004E',
                fontFamily: "Finlandica"
              }}
            >
              {isScanning 
                ? 'Scanning for devices...' 
                : 'No Sync-Sonic devices found. Tap "Scan for Devices" to start scanning.'}
            </Text>
          }
          style={[styles.list, { 
            backgroundColor: themeName === 'dark' ? '#350066' : '#F9F5FF',
            shadowColor: themeName === 'dark' ? '#F2E8FF' : '#26004E',
            borderColor: themeName === 'dark' ? '#F2E8FF' : '#26004E'
          }]}
        />
      </YStack>


      <Button 
        onPress={handleScanPress}
        disabled={loading}
        style={{
          backgroundColor: themeName === 'dark' ? '#E8004D' : '#3E0094',
          width: '90%',
          height: 50,
          borderRadius: 999,
          position: 'absolute',
          bottom: 0,
          marginBottom: 20,
          alignSelf: "center",
          justifyContent: 'center',
          alignItems: 'center'
        }}
        pressStyle={{ opacity: 0.8 }}
      >
        <Text style={{ color: 'white', fontSize: 18, fontFamily: "Inter" }}>
          {isScanning ? 'Scanning...' : 'Scan for Devices'}
        </Text>

        {isScanning && (
          <Loader
            size={40}
            style={{
              position: 'absolute',
              right: -10,
            }}
          />
        )}
      </Button>

    </YStack>
  )
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#F2E8FF' 
  },
  list: {
    maxHeight: "60%",
    alignSelf: "center",
    width: "95%",
    marginBottom: 0,
    borderRadius: 15,
    borderWidth: 1,
    padding: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5
  },
  deviceItem: {
    padding: 16,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: "white",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5
  },
  deviceName: { 
    fontSize: 18,
    fontFamily: "Finlandica",
    letterSpacing: 1
  },
  signalText: {
    fontSize: 14,
    fontFamily: "Finlandica",
    letterSpacing: 1
  }
}); 