import { Button, H1, YStack, View, Image, useThemeName, useTheme } from "tamagui";
import { router } from "expo-router";
import { useEffect } from 'react';
import { setupDatabase } from "./database"; // Import the setup function
import { StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  useEffect(() => {
    // Initialize the database when the app starts
    setupDatabase();
  }, []);

  const handleConnect = () => {
    console.log('Connecting to RPi');
    router.replace('./home');
  };

  const themeName = useThemeName();
  const theme = useTheme();
  
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <YStack style={styles.content}>
        <Image 
          source={require("@/assets/images/logo.png")} 
          style={styles.logo}
        />
        <H1 style={[styles.title, { color: tc }]}>Welcome to Sync-Sonic</H1>
        <Button 
          onPress={handleConnect}
          style={[styles.button, { backgroundColor: pc }]}
        >
          <H1 style={styles.buttonText}>Connect to Box</H1>
        </Button>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: "contain"
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Finlandica"
  },
  button: {
    borderRadius: 15,
    padding: 15,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: "#93C7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: "Finlandica"
  }
});
