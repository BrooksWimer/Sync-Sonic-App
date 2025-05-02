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




export default function Home() {
  const router = useRouter(); // page changing
  const { connectToDevice, dbUpdateTrigger } = useBLEContext();
  const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number, isConnected: number }[]>([]);
  const [speakerStatuses, setSpeakerStatuses] = useState<{ [key: number]: boolean[] }>({});
  const [connecting, setConnecting] = useState(false);
  const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient)

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
   
  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF' // background
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094' // primary color (pink/purple)
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E' // text color
  const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D' // subtext color
  const green = themeName === 'dark' ? '#00FF6A' : '#34A853' // green is *slightly* different on light/dark




  return (
    <YStack flex={1} backgroundColor={bg}>
     <TopBar/>

      {/* Header */}
      <View style={{
          paddingTop: 20,
          paddingBottom: 10,
          alignItems: "center",
          backgroundColor: bg,
          justifyContent: "center",
          paddingHorizontal: 20
      }}>
        <H1 style={{ color: tc, fontFamily: "Finlandica-Medium", fontSize: 40, lineHeight: 44, marginBottom: 5, marginTop: 15, letterSpacing: 1 }}>
          Configurations
        </H1>
      </View>
      <ScrollView style={{ paddingHorizontal: 20, marginBottom: 98 }}>
        {configurations.length === 0 ? (
          <H1 style={{ textAlign: "center", color: stc, fontFamily: "Finlandica", marginVertical: 10 }}>
            No configurations found.
          </H1>
        ) : (
          configurations.map((config, index) => (
            // Touching the configuration takes you to the SpeakerConfigScreen
            <Pressable
            key={config.id}
            delayLongPress={600}
          >
            <XStack
              alignItems="center"
              borderRadius={15}
              padding={15}
              marginBottom="5%"
              borderWidth={1}
              borderColor={tc}
              backgroundColor={bg}
              justifyContent="space-between"
              style={{marginTop: index === 0 ? 15 : 0,
                shadowColor: index === 0 ? green : tc,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
                elevation: 5,
                position: 'relative', 
                overflow: 'hidden',   
              }}
              hoverStyle={{
                shadowRadius: 15,
                shadowOpacity: 1,
                transform: [{ scale: 1.02 }]
              }}
              pressStyle={{
                shadowRadius: 20,
                transform: [{ scale: 1.03 }]
              }}
              onPress={() => router.push({
                pathname: "/SpeakerConfigScreen",
                params: { configID: config.id.toString(), configName: config.name }
              })}
              onLongPress={() => {
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
              
              
              >
                            {/* Gradient background – if want to remove, just remove this section*/}
                            {/* {index === 0 && (
                              
                              <AnimatedGradient
                              colors={[pc + '50', green + '99']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={[
                                StyleSheet.absoluteFillObject,
                                { zIndex: -1 },
                                animatedStyle, 
                              ]}
                              
                            />
                          )} */}
              <YStack>
                <H1 style={{ fontSize: 18, color: tc, fontWeight: "400", fontFamily: "Inter"}}>{config.name}</H1>


               
                            
                {/* Speaker dots */}
                <XStack marginTop={4}>
                    {Array.from({ length: config.speakerCount }).map((_, i) => (
                      <View
                        key={i}
                        style={[styles.statusDot, {
                          backgroundColor: speakerStatuses[config.id]?.[i] ? green : '#FF0055',
                          shadowColor: tc,
                          elevation: 8,
                        }]}
                      />
                    ))}
                  </XStack>

                  

                {/* Connection status */}
                <H1 style={{ fontSize: 14, color: config.isConnected ? green : "#FF0055", marginTop: 6, fontFamily: "Finlandica", letterSpacing: 1}}>
                  {config.isConnected ? "Connected" : "Not Connected"}
                </H1>
              </YStack>

              <Button
                icon={<Pencil size={20} color={tc}/>}
                backgroundColor="transparent"
                onPress={() => router.push({
                  pathname: "/settings/config",
                  params: { configID: config.id.toString(), configName: config.name }
                })}
              />
            </XStack>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Add Button */}



      <View
        style={{
          position: 'absolute',
          bottom: 15+iosbuffer,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <TouchableOpacity
          style={{
              width: 60,
              height: 60,
              justifyContent: 'center',
              alignItems: 'center',
          }}
          onPress={addConfig}
        >
          <CirclePlus size={60} strokeWidth={1} color={green} />
        </TouchableOpacity>


          </View>


    </YStack>
  );
}

const styles = StyleSheet.create({
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  }
});
