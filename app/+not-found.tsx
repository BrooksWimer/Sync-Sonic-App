import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { View, YStack, H1, Button, TamaguiProvider, Theme } from 'tamagui';
import { router } from "expo-router";
import { config } from '@/tamagui.config';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme();
  return (
    <TamaguiProvider config={config}>
      <Theme name={colorScheme}>
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }} backgroundColor="$bg">
          <Stack.Screen options={{ title: 'Oops!', headerShown: false }} />
          <YStack gap={20} alignItems="center">
            <H1>This screen doesn't exist!</H1>
            <Button variant='outlined' onPress={() => router.push('/')}>Go back</Button>
          </YStack>
        </View>
      </Theme>
    </TamaguiProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
