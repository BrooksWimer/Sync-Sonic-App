import { createTamagui, TamaguiProvider, Theme, View } from 'tamagui';
import { config } from '@/tamagui.config'
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
    const colorScheme = useColorScheme();
    return (
    <TamaguiProvider config={config}>
        <Theme name={colorScheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </Theme>
    </TamaguiProvider>
  );
}