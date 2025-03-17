
import { Stack } from 'expo-router';
import { Plus } from '@tamagui/lucide-icons'

import { Button, H1, YStack, View } from "tamagui";
import { router } from "expo-router";
import * as SQLite from 'expo-sqlite';
import {useState, useEffect} from 'react';
import { Image } from "react-native";
import { useRouter } from 'expo-router';

export default function Home() {


  const router = useRouter();
  const configID: number = 123; 
  const addConfig = () => {
    router.push('/settings/config');
    params: { configID: (configID+1).toString() }
  };

  const editConfig = () => {
    router.push('/settings/config');
    params: { configID: configID.toString() }
  };



    return (
        <View  //all
          style={{ 
            flex: 1, 
            //backgroundColor: "$bg" 
          }}
          backgroundColor="$bg"
        >

        {/* Top Bar */}
        <View style={{
                height: 60,
                backgroundColor: "#3E0094",
                justifyContent: "center",
                alignItems: "center",
                paddingTop: 10
              }}>
              <Image 
                  source={require("@/assets/images/horizontalPinkLogo.png")}
                  style={{ width: 100, height: 40, resizeMode: "contain" }}
              />
        </View>

        {/* Header */}
        <View style={{
            paddingTop: 20,
            paddingBottom: 10,
            alignItems: "center",
          }}>
            <H1 style={{ fontSize: 32, fontWeight: "bold" }}>Configurations</H1>
        </View>

        {/* Main Content */}
        <View style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
        }}>
            {/* Add configuration content here */}
        </View>
        

        {/* Plus Button (Floating) */}
        <Button
            icon={Plus}
            onPress={addConfig}
            style={{
                
                position: 'absolute',
                bottom: 20,
                right: 20,
                width: 60,
                height: 60,
                borderRadius: 15,
                backgroundColor: '#FF0055',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
        </Button>
        
        
        </View> //all
    );
}
