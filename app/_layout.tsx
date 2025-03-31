import { TamaguiProvider, Theme } from 'tamagui'
import { config } from '@/tamagui.config'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from '@/hooks/useColorScheme'

export default function RootLayout() {
  const colorScheme = useColorScheme() // should return 'light' or 'dark'

  return (
    <TamaguiProvider config={config} defaultTheme={colorScheme ?? 'light'}>
      <Theme name={colorScheme}>
        <Stack screenOptions={{ headerShown: false }}/>
        <StatusBar style="auto" />
      </Theme>
    </TamaguiProvider>
  )
}
