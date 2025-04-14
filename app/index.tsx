import { useState, useEffect } from "react"
import { YStack, Text, Button, H1, Image, useThemeName, useTheme } from "tamagui"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { PI_API_URL } from "../utils/constants"
import { TopBar } from "../components/TopBar"
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
      <TopBar/>

      {/* Middle Content */}
      <YStack alignItems="center" paddingTop="$4">
        <H1
          style={{ color: tc }}
          fontFamily="Finlandica"
          fontSize={36}
          lineHeight={44}
          fontWeight="700"
        >
          Connect Your Phone
        </H1>

        <Text
          style={{ color: tc }}
          fontSize={16}
          textAlign="center"
          marginTop={16}
          marginBottom={32}
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
            position: 'relative', // <- KEY for absolute child
          }}
          pressStyle={{ opacity: 0.8 }}
        >
          <H1 color="white" fontSize={18}>
            {resetting ? "Resetting..." : "Reset Adapters"}
          </H1>

          {resetting && (
            <LottieView
              source={require('../assets/animations/temp-loader.json')}
              autoPlay
              loop
              style={{
                width: 28,
                height: 28,
                position: 'absolute',
                right: 20, // spacing from the edge
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
          <H1 color="white" fontSize={18}>
            {connecting ? "Connecting..." : "Connect Phone"}
          </H1>

          {connecting && (
            <LottieView
              source={require('../assets/animations/temp-loader.json')}
              autoPlay
              loop
              style={{
                width: 28,
                height: 28,
                position: 'absolute',
                right: 20, // spacing from the edge
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
          <H1 color="white" fontSize={18}>
            Continue to Home
          </H1>
        </Button>
      </YStack>
    </YStack>
  )
}
