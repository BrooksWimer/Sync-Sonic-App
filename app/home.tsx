// List of configs to select from
import { View, H1, YStack } from "tamagui";
import { Stack } from 'expo-router';
import { router } from "expo-router";

export default function Home() {
    return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
      backgroundColor="$bg"
    >
    <YStack style={{
        justifyContent: "center",
        alignItems: "center"
      }}>
        <H1>Home</H1>
    </YStack>
        
    </View>
    );
}