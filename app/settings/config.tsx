
import { Stack } from 'expo-router';
import { Plus, SquareX } from '@tamagui/lucide-icons'

import { Button, H1, YStack, View , Input, Label, ScrollView, XStack} from "tamagui";
import { router } from "expo-router";
import * as SQLite from 'expo-sqlite';
import {useState, useEffect} from 'react';
import { Image,Linking,PermissionsAndroid, Platform} from "react-native";
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from "expo-router";
//import { BleManager } from 'react-native-ble-plx';


export default function Home() {

    const params = useLocalSearchParams();
    const configID: number = Number(params.configID)

    const returnHome = () => {
        // logic to add configuration
        router.push('../home');
    };

    const openSettings = () => {
        Linking.openSettings(); // Opens system settings 
    };

    const editHeader: String= "Edit Configuration";
    const createHeader: String="Create Configuration";

    const [configName, setConfigName] = useState("");

    const [devices, setDevices] = useState<{ id: number, name: string, mac: string }[]>([]);

    // Function to insert dummy data
    const insertDummyData = () => {
        const dummyDevices = [
            { id: 0, name: "JBL abc", mac: "B8-BF-8F-61-BC-EE" },
            { id: 1, name: "Sony def", mac: "C5-AE-2C-73-F0-A7" },
            { id: 2, name: "Sonos ghi", mac: "5D-8D-1C-30-BD-8C" }
        ];
        setDevices(dummyDevices);
    };

    // Function to delete a device from the list
    const deleteDevice = (id: number) => {
        setDevices(prevDevices => prevDevices.filter(device => device.id !== id));
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
            <H1 style={{ fontSize: 32, fontWeight: "bold" }}>{editHeader}</H1>
        </View>

        {/* Configuration Name Input Field */}
        <YStack marginHorizontal={20} marginTop={10} gap={10}> 
            <Label htmlFor="configName" fontSize={18}>
                Configuration Name:
            </Label>
            <Input
                id="configName"
                value={configName}
                onChangeText={setConfigName}
                placeholder="Enter configuration name"
                placeholderTextColor='#888880'
                borderWidth={1}
                borderColor="#3E0094"
                padding={10}
                fontSize={16}
            />

        {/* Open Settings*/}
        <Button 
                onPress={openSettings} 
                backgroundColor="#3E0094"
                color="white"
                borderRadius={5}
                padding={10}
            >
                
                    Find Bluetooth Devices
                
            </Button>
        </YStack>

       {/* List of Found Bluetooth Devices */}
       <ScrollView style={{ maxHeight: 200, marginTop: 10, paddingHorizontal: 20 }}>
                {devices.length === 0 ? (
                    <H1>
                        No devices connected. Please connect devices
                    </H1>
                ) : (
                    devices.map((device) => (
                        <XStack 
                            key={device.id} 
                            alignItems="center"
                            paddingVertical={10}
                            borderBottomWidth={1}
                            borderColor="#ddd"
                            justifyContent="space-between"
                        >
                            <View>
                                <H1 style={{ fontWeight: "bold"}} fontSize={16}>{device.name}</H1>
                                <H1 fontSize={12}>{device.mac}</H1>
                            </View>
                            <Button
                                icon={SquareX}
                                backgroundColor="red"
                                color="white"
                                borderRadius={5}
                                onPress={() => deleteDevice(device.id)}
                            >
                                
                            </Button>
                        </XStack>
                    ))
                )}
            </ScrollView>

            {/* Button to Insert Dummy Data */}
            <Button 
                onPress={insertDummyData} 
                backgroundColor="#007AFF"
                color="white"
                borderRadius={5}
                padding={15}
                margin={20}
                width="90%"
                alignSelf="center"
            >
                DEMO: Insert Dummy Data
            </Button>

        

        {/* Plus Button (Floating) */}
        {/* Full-Width Button at Bottom */}
        <Button
                onPress={returnHome}
                backgroundColor="#FF0055"
                color="white"
                borderRadius={0}  // Makes it stretch full width
                position="absolute"
                bottom={0}
                width="100%"
                height={60}
                justifyContent="center" //needs error handling vvv
            > 
                
                    Save 
                    
                
            </Button>

        
        
        </View> //all
    );
}
