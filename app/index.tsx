import { Button, H1, YStack, View, Image } from "tamagui";
import { router } from "expo-router";
import { useEffect } from 'react';
import { setupDatabase } from "./database"; // Import the setup function

export default function Index() {
  useEffect(() => {
    // Initialize the database when the app starts
    setupDatabase();
  }, []);

  const handleConnect = () => {
    console.log('Connecting to RPi');
    router.replace('./home');
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
      backgroundColor="$bg"
    >
      <YStack
        style={{
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <Image source={require("@/assets/images/logo.png")} />
        <H1>Welcome to Sync-Sonic</H1>
        <Button 
          variant="outlined"
          onPress={handleConnect}
          pressStyle={{ opacity: 0.8 }}
        >
          Connect to Box
        </Button>
      </YStack>
    </View>
  );
}
