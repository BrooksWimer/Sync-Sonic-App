import { TamaguiProvider, Theme } from 'tamagui'
import { config } from '@/tamagui.config'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from '@/hooks/useColorScheme'

export default function RootLayout() {
  const colorScheme = useColorScheme() // 'light' or 'dark'

  return (
    <TamaguiProvider config={config} defaultTheme={colorScheme ?? 'light'}>
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
        <StatusBar style="auto" />
      </Theme>
    </TamaguiProvider>
  )
}
