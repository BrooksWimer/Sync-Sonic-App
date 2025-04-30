import { useState, useEffect } from "react";
import {
  YStack, Text, Button, H1, Image,
  useThemeName, useTheme
} from "tamagui";
import LottieView   from "lottie-react-native";
import { Alert }    from "react-native";
import { router }   from "expo-router";

import { TopBarStart }       from "../components/TopBarStart";
import { setupDatabase }     from "./database";

import { useBLEContext }     from "@/contexts/BLEContext";
import { SERVICE_UUID }      from "@/utils/ble_constants";
import {
  getLastConnectedDevice,
  saveLastConnectedDevice
} from "@/app/database";

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



  /* -------------------------------------------------------------- */
  /*  theme + BLE helpers                                           */
  /* -------------------------------------------------------------- */
  const {
    manager,                 // BleManager instance from context
    scanForPeripherals,      // starts a scan (15 s timeout handled below)
    stopScan,
    connectToDevice,         // Device → Promise<Device>
    allDevices,              // filled by the scan
    waitForPi
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
    let deviceConnection = null;
  
    // 1) Try to reconnect to the Pi via cached ID, but *verify* its services
    const lastId = await getLastConnectedDevice();
    if (lastId) {
      try {
        const [cached] = await manager.devices([lastId]);
        if (cached) {
          const conn = await connectToDevice(cached);
          // discover & check
          await conn.discoverAllServicesAndCharacteristics();
          const services = await conn.services();
          console.log("🔍 Fast-reconnected services:", services.map(s=>s.uuid));
          if (services.some(s=>s.uuid === SERVICE_UUID)) {
            console.log("✅ fast-reconnected to Pi", lastId);
            deviceConnection = conn;
          } else {
            console.warn("⚠️ fast path got wrong device, dropping it");
            await conn.cancelConnection();
          }
        }
      } catch (e) {
        console.log("⚠️ fast reconnect failed:", e);
      }
    }
  
    // 2) If that didn’t work, do a filtered scan for the Pi’s service
    if (!deviceConnection) {
      console.log("🔎 Scanning for Pi advertising our SERVICE_UUID…");
      let piDevice = null;
      manager.startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error(error);
            return;
          }
          if (device && device.serviceUUIDs?.includes(SERVICE_UUID)) {
            piDevice = device;
            manager.stopDeviceScan();
          }
        }
      );
      // wait a couple seconds
      await new Promise(r => setTimeout(r, 2000));
  
      if (!piDevice) {
        console.error("❌ Could not find Pi advertising our GATT service");
        setConnecting(false);
        router.push('/connect-device');
        return;
      }
      deviceConnection = await connectToDevice(piDevice);
      console.log("✅ Scanned & connected to Pi", piDevice.id);
    }
  
    // 3) Save the Pi’s ID for next time
    await saveLastConnectedDevice(deviceConnection.id);
    setConnecting(false);
  };


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
      <YStack alignItems="center" paddingTop="$4">
        <H1
          style={{ color: tc, fontFamily: "Finlandica" }}
          fontSize={36}
          lineHeight={44}
          fontWeight="700"
          letterSpacing={1}
        >
          Connect Your Phone
        </H1>

        <Text
          style={{ color: tc, fontFamily: "Finlandica" }}
          fontSize={16}
          textAlign="center"
          marginTop={16}
          marginBottom={32}
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



        <Button
          onPress={handleConnect}
          disabled={connecting}
          style={{
            backgroundColor: pc,
            width: '90%',
            height: 50,
            borderRadius: 999,
            alignSelf: 'center',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative', // <- KEY for absolute child
          }}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontFamily: "Inter" }}>
            {connecting ? "Connecting..." : "Connect Phone"}
          </Text>
        </Button>


        <Button
          onPress={goHome}
          style={{
            backgroundColor: pc,
            width: '90%',
            height: 50,
            borderRadius: 999,
            alignSelf: 'center',
          }}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontFamily: "Inter"}}>
            Continue to Home
          </Text>
        </Button>
      </YStack>
    </YStack>
  )
}
