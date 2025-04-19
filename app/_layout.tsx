import { TamaguiProvider, Theme } from 'tamagui'
import { config } from '@/tamagui.config'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from '@/hooks/useColorScheme'
import { useFonts } from 'expo-font'
import { FontProvider } from '../utils/fonts'

export default function RootLayout() {
  const colorScheme = useColorScheme() // 'light' or 'dark'

  const backgroundColor = colorScheme === 'dark' ? '#250047' : '#F2E8FF'
  const pc = colorScheme === 'dark' ? '#E8004D' : '#3E0094'

  return (
    <TamaguiProvider config={config} defaultTheme={colorScheme ?? 'light'}>
      <FontProvider>
        <Theme name={colorScheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="index"
              options={{
                animation: 'slide_from_left', // customize this as needed
              }}
            />
            {/* Add more screens with custom options here if needed */}
          </Stack>
          <StatusBar
            style={colorScheme === 'dark' ? 'light' : 'dark'}
            backgroundColor={pc} // ✅ makes status bar match background
            translucent={false}
          />
        </Theme>
      </FontProvider>
    </TamaguiProvider>
  )
}
