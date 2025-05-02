import { useState, useEffect } from "react";
import {
  YStack, Text, Button, H1, Image,
  useThemeName, useTheme
} from "tamagui";
import { Platform }    from "react-native";
import { router }   from "expo-router";
import { setupDatabase, getConfigurations, getSpeakersFull, updateSpeakerSettings, updateConnectionStatus, updateSpeakerConnectionStatus } from "../utils/database"
import { TopBarStart } from "../components/TopBarStart"

import { useBLEContext }     from "@/contexts/BLEContext";
import { SERVICE_UUID, BLE_DEVICE_NAME }      from "@/utils/ble_constants";
import {
  getLastConnectedDevice,
  saveLastConnectedDevice,
  removeLastConnectedDevice
} from "@/utils/database";
import { Device } from 'react-native-ble-plx';
import { BottomButton } from "@/components/BottomButton";
import { Alert } from "react-native";


export default function Index() {
  const themeName = useThemeName();
  const theme = useTheme();
  
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF';
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094';
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E';
  const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D';
  const green = themeName === 'dark' ? '#00FF6A' : '#34A853';
  const red = themeName === 'dark' ? 'black' : '#E8004D';

  const imageSource = themeName === 'dark'
    ? require('../assets/images/welcomeGraphicDark.png')
    : require('../assets/images/welcomeGraphicLight.png');


  //if android
  let abuffer = 20
  let iosbuffer = 0
  //else, 
  if (Platform.OS === 'ios') {
    abuffer = 0
    iosbuffer = 20
  }

  const loaderSource = themeName === 'dark'
  ? require('../assets/animations/SyncSonic_Loading_Light_nbg.json')
  : require('../assets/animations/SyncSonic_Loading_Dark_nbg.json');

  /* -------------------------------------------------------------- */
  /*  theme + BLE helpers                                           */
  /* -------------------------------------------------------------- */
  const {
    manager,                 // BleManager instance from context
    scanForPeripherals,      // starts a scan (15 s timeout handled below)
    stopScan,
    connectToDevice,         // Device → Promise<Device>
    allDevices,              // filled by the scan
    waitForPi,
    ensurePiNotifications,
    handleNotification,
    requestPermissions
  } = useBLEContext();

  const [connecting, setConnecting] = useState(false);

  /* -------------------------------------------------------------- */
  /*  initial DB setup                                              */
  /* -------------------------------------------------------------- */
  useEffect(() => { setupDatabase(); }, []);

  /* -------------------------------------------------------------- */
  /*  connect Phone button                                                */
  /* -------------------------------------------------------------- */
  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      // First check permissions
      const permissionsGranted = await requestPermissions();
      if (!permissionsGranted) {
        setConnecting(false);
        Alert.alert(
          "Bluetooth Permissions Required",
          "Please enable Bluetooth permissions to connect to your SyncBox.",
          [{ text: "OK" }]
        );
        return;
      }

      let deviceConnection = null;
    
      // 1) Fast-path: check cached ID's advertised services _before_ connect
      const lastId = await getLastConnectedDevice();
      if (lastId) {
        try {
          const [cached] = await manager.devices([lastId]);
          if (cached) {
            console.log("🔍 cached device info:", cached.id, cached.name, cached.serviceUUIDs);
    
            // only proceed if it's actually our Pi (by UUID & optional name)
            const hasSvc = cached.serviceUUIDs?.includes(SERVICE_UUID);
            const isPi = cached.name?.startsWith(BLE_DEVICE_NAME);
            if (hasSvc && isPi) {
              console.log("✅ Fast-path: cached device looks good, connecting...");
              const conn = await connectToDevice(cached);
              await conn.discoverAllServicesAndCharacteristics();
              deviceConnection = conn;
              await ensurePiNotifications(conn, handleNotification);
            } else {
              console.warn("⚠️ Cached device isn't our Pi—dropping it");
              await removeLastConnectedDevice();  // clear bad cache
            }
          }
        } catch (e) {
          console.log("⚠️ Fast reconnect attempt threw:", e);
          await removeLastConnectedDevice();    // clear cache on error
        }
      }
    
         // 2) Full scan if fast path failed
      if (!deviceConnection) {
        console.log("🔎 Scanning for Pi advertising SERVICE_UUID…");
        
        // 🛑 STOP any existing scan first
        manager.stopDeviceScan();

        const foundDevice = await new Promise<Device | null>((resolve) => {
          manager.startDeviceScan(
            [SERVICE_UUID],
            { allowDuplicates: false },
            (error, device) => {
              if (error) {
                console.error("Scan error", error);
                return;
              }
              if (
                device &&
                device.serviceUUIDs?.includes(SERVICE_UUID) &&
                device.name?.startsWith(BLE_DEVICE_NAME)
              ) {
                console.log("🔔 Found Pi during scan:", device.id, device.name);
                manager.stopDeviceScan();
                resolve(device);
              }
            }
          );
          // Timeout after 3 seconds
          setTimeout(() => resolve(null), 3000);
        });

        if (!foundDevice) {
          console.error("❌ Could not find Pi advertising our GATT service");
          setConnecting(false);
          router.push('/connect-device');
          return;
        }

        deviceConnection = await connectToDevice(foundDevice);
        console.log("✅ Scanned & connected to Pi", foundDevice.id);
        await ensurePiNotifications(deviceConnection, handleNotification);
        setConnecting(false);
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnecting(false);
      Alert.alert(
        "Connection Error",
        "Failed to connect to SyncBox. Please try again.",
        [{ text: "OK" }]
      );
    }
  }

  const goHome = () => {
    router.push('/home');
  }


  return (
    <YStack
      flex={1}
      style={{ backgroundColor: bg }}
      justifyContent="space-between"
    >
      <TopBarStart/>

      {/* Middle Content */}
      <YStack alignItems="center" paddingTop={40}>
        <H1
          style={{ color: tc, fontFamily: "Finlandica-Medium" }}
          fontSize={40}
          lineHeight={44}
          letterSpacing={1}
        >
          Welcome
        </H1>

        <Text
          style={{ color: tc, fontFamily: "Inter-Regular" }}
          fontSize={16}
          textAlign="center"
          marginTop={16}
          //marginBottom={32}
          paddingHorizontal={20}
        >
          To stream music from your phone, please turn on Bluetooth and pair it with the box.
        </Text>

        <Image
          source={imageSource}
          style={{ width: 250, height: 250, marginBottom: 40 }}
          resizeMode="contain"
        />
      </YStack>

      {/* Bottom Buttons */}
      <YStack space="$4" paddingBottom="$4">

        {/* REMOVE THIS EVENTUALLY */}
        <Button
          onPress={goHome}
          style={{
            backgroundColor: pc,
            width: '90%',
            height: 50,
            borderRadius: 15,
            alignSelf: 'center',
            
          }}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontFamily: "Inter"}}>
            Continue to Home
          </Text>
        </Button>

        <BottomButton
          onPress={handleConnect}
          disabled={connecting}
          isLoading={connecting}
          text={connecting ? "Connecting..." : "Connect to SyncBox"}
          fontFamily="Inter"
        />

      </YStack>
    </YStack>
  )
}
