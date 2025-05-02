import React, { useState, useEffect, useCallback } from 'react';
import {CirclePlus} from '@tamagui/lucide-icons'
import { Button, H1, YStack, View, XStack, ScrollView, Text, useThemeName, useTheme } from "tamagui";
import { ActivityIndicator, Platform, Pressable, StatusBar, TouchableOpacity } from 'react-native';
import { Plus, Pencil } from '@tamagui/lucide-icons';
import { Image, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteConfiguration, getConfigurations, getSpeakersFull } from '@/utils/database';
import { TopBar } from '@/components/TopBar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useBLEContext } from '../contexts/BLEContext';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/TitleText';
import { Body } from '@/components/BodyText';
import { ConfigurationCard } from '@/components/ConfigurationCard';
import { useAppColors } from '@/styles/useAppColors';
import { FloatingAddButton } from '@/components/AddButton';









export default function Home() {
  const router = useRouter(); // page changing
  const { connectToDevice, dbUpdateTrigger } = useBLEContext();
  const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number, isConnected: number }[]>([]);
  const [speakerStatuses, setSpeakerStatuses] = useState<{ [key: number]: boolean[] }>({});
  const [connecting, setConnecting] = useState(false);
  const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient)
  const { bg, pc, tc, stc, green} = useAppColors();
  const g = green as any;


  //if android
  let abuffer = 20
  let iosbuffer=0
  //else, 
  if (Platform.OS === 'ios') {
      abuffer = 0
      iosbuffer=20
  }

  // Fetch configurations and their speaker statuses
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const configs = await getConfigurations();
          setConfigurations(configs);

          // Fetch speaker statuses for each configuration
          const statuses: { [key: number]: boolean[] } = {};
          for (const config of configs) {
            const speakers = getSpeakersFull(config.id);
            statuses[config.id] = speakers.map(speaker => speaker.is_connected === 1);
          }
          setSpeakerStatuses(statuses);
        } catch (error) {
          console.error('Error fetching configurations:', error);
        }
      };

      fetchData();
    }, [dbUpdateTrigger]) // Add dbUpdateTrigger as a dependency
  );

  // Function to navigate to create a new configuration.
  const addConfig = () => {
    router.push('/settings/config');
    console.log("creating new configuration . . .");
  };

  const themeName = useThemeName();
  const theme = useTheme();
  
  const imageSource = themeName === 'dark'
    ? require('../assets/images/welcomeGraphicDark.png')
    : require('../assets/images/welcomeGraphicLight.png')

  const logo = themeName === 'dark'
    ? require('../assets/images/horizontalLogoDark.png')
    : require('../assets/images/horizontalLogoLight.png')
   




  return (
    <YStack flex={1} backgroundColor={bg as any}>
      {/* Top Bar with Back Button -----------------------------------------------------------------*/}
      <TopBar/>

      {/* Header -----------------------------------------------------------------------------------*/}
      <Header title="Configurations"/>


      {/* ScrollView for Configurations ------------------------------------------------------------*/}
      <ScrollView style={{ paddingHorizontal: 20, marginBottom: 98 }}>
          {configurations.length === 0 ? (
            <H1
              style={{
                textAlign: 'center',
                color: stc,
                fontFamily: 'Finlandica',
                marginVertical: 10,
              }}
            >
              No configurations found.
            </H1>
          ) : (
            configurations.map((config, index) => (
              <ConfigurationCard
                key={config.id}
                config={config}
                index={index}
                speakerStatuses={speakerStatuses[config.id] || []}
                onDelete={async () => {
                  try {
                    await deleteConfiguration(config.id);
                    setConfigurations(prev => prev.filter(c => c.id !== config.id));
                  } catch (err) {
                    console.error("Failed to delete configuration:", err);
                  }
                }}
              />
            ))
          )}
        </ScrollView>
        {/* ScrollView for Configurations ------------------------------------------------------------*/}

      


      {/* Add Button -----------------------------------------------------------------------------------*/}
      <FloatingAddButton onPress={addConfig} />
      {/* Add Button -----------------------------------------------------------------------------------*/}


    </YStack>
  );
}
