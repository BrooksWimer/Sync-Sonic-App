import { useState, useEffect } from "react";
import {
  YStack, Text, Button, Image,
  useThemeName, useTheme
} from "tamagui";
import { Platform }    from "react-native";
import { router }   from "expo-router";
import { setupDatabase } from "../utils/database"
import { TopBarStart } from "../components/TopBarStart"

import { useBLEContext }     from "@/contexts/BLEContext";
import { SERVICE_UUID }      from "@/utils/ble_constants";
import {
  getLastConnectedDevice,
  removeLastConnectedDevice
} from "@/utils/database";
import { Device } from 'react-native-ble-plx';
import { BottomButton } from "@/components/BottomButton";
import { Body } from '@/components/BodyText';
import { useAppColors } from '@/styles/useAppColors';
import { Header } from "@/components/TitleText";


export default function Index() {
    const themeName = useThemeName();
    const theme = useTheme();
    const { bg, pc, tc, stc, green} = useAppColors();
    const g = green as any;

  const imageSource = themeName === 'dark'
    ? require('../assets/images/welcomeGraphicDark.png')
    : require('../assets/images/welcomeGraphicLight.png');


   //if android
      let abuffer = 20
      let iosbuffer=0
      //else, 
      if (Platform.OS === 'ios') {
            abuffer = 0
            iosbuffer=20
        }

  const loaderSource = themeName === 'dark'
  ? require('../assets/animations/SyncSonic_Loading_Light_nbg.json')
  : require('../assets/animations/SyncSonic_Loading_Dark_nbg.json');

  /* -------------------------------------------------------------- */
  /* BLE helpers                                                    */
  /* -------------------------------------------------------------- */
  const {
    manager,                 // BleManager instance from context
    scanForPeripherals,      // starts a scan (15 s timeout handled below)
    stopScan,
    connectToDevice,         // Device → Promise<Device>
    allDevices,              // filled by the scan
    waitForPi,
    ensurePiNotifications,
    handleNotification
  } = useBLEContext();

  const [connecting, setConnecting] = useState(false);

  /* -------------------------------------------------------------- */
  /*  initial DB setup                                              */
  /* -------------------------------------------------------------- */
  useEffect(() => { setupDatabase(); }, []);

  /* -------------------------------------------------------------- */
  /*  connect Phone button                                          */
  /* -------------------------------------------------------------- */
  const handleConnect = async () => {
    setConnecting(true);
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
          const isPi   = cached.name?.startsWith("Sync-Sonic");  // or whatever your Pi advertises
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
              device.name?.startsWith("Sync-Sonic")
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
        router.push('/connect-device');
    }
  }

  return (
      <YStack flex={1} justifyContent="space-between" backgroundColor={bg as any}>
        {/* Top Bar without Back Button -----------------------------------------------------------------*/}
        <TopBarStart/>

       
        <YStack alignItems="center" paddingTop="$6" paddingBottom="$4" space="$4">
          {/* Header -----------------------------------------------------------------------------------*/}
          <Header title="Welcome"/>
          
          {/* Instructions -----------------------------------------------------------------------------------*/}
          <Body>
            To stream music from your phone, please turn on Bluetooth and pair it with the box.
          </Body>

          <Image
            source={imageSource}
            style={{ width: 250, height: 250 }}
            resizeMode="contain"
          />
        </YStack>

       
        
        <YStack paddingBottom={Platform.OS === 'ios' ? 100 : 100} space="$4">
          {/* remove this later (do NOT remove the Ystack*/}
        <Button
            onPress={() => router.push('/home')}
            style={{
              backgroundColor: pc,
              width: '90%',
              height: 50,
              borderRadius: 15,
              alignSelf: 'center',
            }}
            pressStyle={{ opacity: 0.8 }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontFamily: "Inter" }}>
              Continue to Home
            </Text>
          </Button>
          {/* remove up to here */}
         
        </YStack>
        
        <BottomButton
            onPress={handleConnect}
            disabled={connecting}
            isLoading={connecting}
            text={connecting ? "Connecting..." : "Connect to SyncBox"}
            fontFamily="Inter"
          />
      </YStack>
  )
}
