import React, { useState, useEffect, useCallback } from 'react';
import { Button, H1, YStack, View, XStack, ScrollView, Text, useThemeName, useTheme } from "tamagui";
import { ActivityIndicator, Pressable, StatusBar } from 'react-native';
import { Plus, Pencil } from '@tamagui/lucide-icons';
import { Image, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteConfiguration, getConfigurations, getSpeakersFull } from './database';
import { TopBar } from '@/components/TopBar';
import { AddButton } from '@/components/AddButton'
import { PI_API_URL } from '../utils/constants'
import { handleDeleteConfig } from '@/utils/ConfigurationFunctions'

export default function Home() {
  const router = useRouter(); // page changing
  const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number, isConnected: number }[]>([]);
  const [speakerStatuses, setSpeakerStatuses] = useState<{ [key: number]: boolean[] }>({});

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
    }, [])
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
   
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
  const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'

  return (
    <YStack flex={1} backgroundColor={bg}>
      <TopBar/>
      <ScrollView>
        <YStack padding={20} gap={20}>
          <H1 style={{ fontSize: 32, fontWeight: "bold", color: tc }}>Configurations</H1>
          
          {configurations.map((config) => (
            <Pressable
              key={config.id}
              onLongPress={() => handleDeleteConfig(config.id, setConfigurations)}
              delayLongPress={600}
            >
              <XStack
                alignItems="center"
                borderRadius={15}
                padding={15}
                marginBottom={10}
                borderWidth={1}
                borderColor={stc}
                justifyContent="space-between"
                shadowColor="#93C7FF"
                shadowOffset={{ width: 0, height: 0 }}
                shadowOpacity={0.8}
                shadowRadius={8}
                hoverStyle={{
                  shadowRadius: 15,
                  shadowOpacity: 1,
                  transform: [{ scale: 1.02 }]
                }}
                pressStyle={{
                  shadowRadius: 20,
                  transform: [{ scale: 1.04 }]
                }}
                onPress={() => router.push({
                  pathname: "/SpeakerConfigScreen",
                  params: { configID: config.id.toString(), configName: config.name }
                })}
                onLongPress={() => handleDeleteConfig(config.id, setConfigurations)}
              >
                <YStack>
                  <H1 fontSize={18} color={tc}>{config.name}</H1>
                  <Text style={{ color: stc }}>{config.speakerCount} speakers</Text>
                </YStack>
                <XStack gap={5}>
                  {speakerStatuses[config.id]?.map((isConnected, index) => (
                    <View
                      key={index}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: isConnected ? '#4CAF50' : '#FF5252'
                      }}
                    />
                  ))}
                </XStack>
              </XStack>
            </Pressable>
          ))}
        </YStack>
      </ScrollView>
      <AddButton onPress={addConfig} />
    </YStack>
  );
}

const styles = StyleSheet.create({
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  }
});
