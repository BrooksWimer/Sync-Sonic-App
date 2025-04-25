import { TamaguiProvider, Theme } from 'tamagui'
import { config } from '@/tamagui.config'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from '@/hooks/useColorScheme'
import { useFonts } from 'expo-font'
import { FontProvider } from '../utils/fonts'
import { BLEProvider } from '../contexts/BLEContext'

export default function RootLayout() {
  const colorScheme = useColorScheme() // 'light' or 'dark'

  const backgroundColor = colorScheme === 'dark' ? '#250047' : '#F2E8FF'
  const pc = colorScheme === 'dark' ? '#E8004D' : '#3E0094'

  return (
    <TamaguiProvider config={config} defaultTheme={colorScheme ?? 'light'}>
      <FontProvider>
        <BLEProvider>
          <Theme name={colorScheme}>
            <Stack 
              screenOptions={{ 
                headerShown: false,
                animation: 'slide_from_right',
                gestureEnabled: true
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  animation: 'slide_from_left',
                  gestureEnabled: false
                }}
              />
              <Stack.Screen
                name="connect-device"
                options={{
                  animation: 'slide_from_right',
                  gestureEnabled: true
                }}
              />
              <Stack.Screen
                name="home"
                options={{
                  animation: 'slide_from_right',
                  gestureEnabled: true
                }}
              />
              <Stack.Screen
                name="DeviceSelectionScreen"
                options={{
                  animation: 'slide_from_right',
                  gestureEnabled: true
                }}
              />
              <Stack.Screen
                name="SpeakerConfigScreen"
                options={{
                  animation: 'slide_from_right',
                  gestureEnabled: true
                }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  animation: 'slide_from_right',
                  gestureEnabled: true
                }}
              />
            </Stack>
            <StatusBar
              style={colorScheme === 'dark' ? 'light' : 'dark'}
              backgroundColor={pc}
              translucent={false}
            />
          </Theme>
        </BLEProvider>
      </FontProvider>
    </TamaguiProvider>
  )
}
