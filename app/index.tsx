import { Button, H1, YStack, View, Image } from "tamagui";
import { router } from "expo-router";
import * as SQLite from 'expo-sqlite';
import {useState, useEffect} from 'react';
import { setupDatabase } from "./database"; // Import the function

export default function Index() {
  const handleConnect = () => {
    console.log('Connecting to RPi');
    router.replace('./home');
  }
  useEffect(() => {
    setupDatabase(); // Initialize database on app start
}, []);
  

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
        <Image source={require("@/assets/images/logo.png")} />
        <H1>Welcome to Sync-Sonic</H1>
        <Button 
          variant="outlined"
          onPress={handleConnect}
          pressStyle={{opacity: 0.8}}
        >
          Connect to Box
        </Button>
      </YStack>
    </View>
  );
}
