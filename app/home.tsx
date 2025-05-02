import React, { useState, useCallback } from 'react';
import { H1, YStack, ScrollView, useThemeName, useTheme } from "tamagui";
import { Platform } from 'react-native';
import { Alert } from "react-native";
import { useFocusEffect, useRouter } from 'expo-router';
import { deleteConfiguration, getConfigurations, getSpeakersFull } from '@/utils/database';
import { TopBar } from '@/components/TopBar';
import Animated from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useBLEContext } from '../contexts/BLEContext';
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
      <ScrollView style={{ paddingHorizontal: 20, 
              marginBottom: 98, 
              shadowColor: tc,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
              elevation: 15,}}>
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
                  if (Platform.OS === "ios") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  }
                    Alert.alert(
                    "Delete Configuration?",
                    `Are you sure you want to delete "${config.name}"?`,
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteConfiguration(config.id)
                            setConfigurations(prev => prev.filter(c => c.id !== config.id))
                          } catch (err) {
                            console.error("Failed to delete configuration:", err)
                          }
                        },
                      },
                    ],
                    { cancelable: true }
                  )
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
