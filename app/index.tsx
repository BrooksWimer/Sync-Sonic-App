import { useState, useEffect } from "react"
import { YStack, Text, Button, H1, Image, useThemeName, useTheme } from "tamagui"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { PI_API_URL } from "../utils/constants"
import { setupDatabase } from "./database"
import { TopBarStart } from "../components/TopBarStart"
import colors from '../assets/colors/colors'
import LottieView from "lottie-react-native"

export default function ConnectPhone() {
  const [connecting, setConnecting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const themeName = useThemeName();
  const theme = useTheme();

  const imageSource = themeName === 'dark'
    ? require('../assets/images/welcomeGraphicDark.png')
    : require('../assets/images/welcomeGraphicLight.png')

  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'


  const loaderSource = themeName === 'dark'
  ? require('../assets/animations/SyncSonic_Loading_Light_nbg.json')
  : require('../assets/animations/SyncSonic_Loading_Dark_nbg.json');


  useEffect(() => {
    setupDatabase();
  }, []);

  const handleConnect = async () => {
    setConnecting(true)

    // Open Bluetooth settings
    Linking.openSettings()

    // Fire off the pairing request (no need to wait for success right now)
    try {
      await fetch(`${PI_API_URL}/connect_phone`, { method: "POST" })
    } catch (err) {
      console.error("⚠️ Failed to call /connect_phone:", err)
    }

    setConnecting(false)
  }

  const goHome = () => {
    router.push("/home")
  }

  const handleResetAdapters = async () => {
    setResetting(true);
    try {
      await fetch(`${PI_API_URL}/reset-adapters`, { method: "POST" });
    } catch (err) {
      console.error("⚠️ Failed to reset adapters:", err);
    }
    setResetting(false);
  };

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
          letterSpacing={1}
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
          onPress={handleResetAdapters}
          disabled={resetting}
          style={{
            backgroundColor: pc,
            width: '90%',
            height: 50,
            borderRadius: 999,
            alignSelf: 'center',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontFamily: "Inter" }}>
            {resetting ? "Resetting..." : "Reset Adapters"}
          </Text>

          {resetting && (
            <LottieView
              source={loaderSource}
              autoPlay
              loop
              style={{
                width: 100,
                height: 100,
                position: 'absolute',
                right: -10, // spacing from the edge
              }}
            />
          )}
        </Button>


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

          {connecting && (
            <LottieView
              source={loaderSource}
              autoPlay
              loop
              style={{
                width: 100,
                height: 100,
                position: 'absolute',
                right: -10, // spacing from the edge
              }}
            />
          )}
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
