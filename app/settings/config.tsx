
import { Stack } from 'expo-router';
import { SquareX, ArrowLeftSquare} from '@tamagui/lucide-icons' /////////////
import { addSpeaker, getSpeakers, deleteSpeaker, addConfiguration, logDatabaseContents, updateConfiguration, deleteSpeakerById, deleteConfiguration } from '../database';
import { Button, H1, YStack, View , Input, Label, ScrollView, XStack} from "tamagui";
import { router } from "expo-router";
import * as SQLite from 'expo-sqlite';
import {useState, useEffect} from 'react';
import { Alert, Image,Linking,PermissionsAndroid, Platform} from "react-native";
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from "expo-router";
//import { BleManager } from 'react-native-ble-plx';


export default function Config() {

    const params = useLocalSearchParams();
    const configID: number = Number(params.configID)
    const initialConfigName = params.configName ? params.configName.toString() : "";

    useEffect(() => {
        setDevices(getSpeakers(configID));
    }, [configID]);
    

    const openSettings = () => {
        Linking.openSettings(); // Opens system settings 
    };

    const editHeader: String= "Edit Configuration";
    const createHeader: String="Create Configuration";

    const [configName, setConfigName] = useState(initialConfigName);
    const [devices, setDevices] = useState<{ id: number, name: string, mac: string }[]>([]);
    const [deletedSpeakers, setDeletedSpeakers] = useState<number[]>([]); // Track speakers to delete

    useEffect(() => {
        setDevices(getSpeakers(configID));
    }, [configID]);

    useEffect(() => {
        getSpeakers(configID, setDevices);
    }, [configID]);


    // Function to insert dummy data
    const insertDummyData = () => {
        const dummyDevices = [
            { id: 0, name: "JBL abc", mac: "B8-BF-8F-61-BC-EE" },
            { id: 1, name: "Sony def", mac: "C5-AE-2C-73-F0-A7" },
            { id: 2, name: "Sonos ghi", mac: "5D-8D-1C-30-BD-8C" }
        ];
        setDevices(dummyDevices);
    };


    const removeDevice = (id: number) => {
        setDeletedSpeakers(prev => [...prev, id]); // Mark for deletion
        setDevices(prevDevices => prevDevices.filter(device => device.id !== id));
    };

    // Save changes (update name, add/remove speakers)
    const saveChanges = () => {
        if (!configName.trim() || devices.length === 0) return; // Prevent saving if no devices or name is empty

        if (configID) {
            // Update existing configuration name
            updateConfiguration(configID, configName);

            // Delete marked speakers permanently
            deletedSpeakers.forEach(speakerId => deleteSpeakerById(speakerId));

            // Save new speakers (only those without an existing ID)
            devices.forEach(device => {
                if (!device.id) {
                    addSpeaker(configID, device.name, device.mac);
                }
            });
        } else {
            // Create new configuration
            addConfiguration(configName, (newConfigID) => {
                devices.forEach(device => addSpeaker(newConfigID, device.name, device.mac));
            });
        }

        logDatabaseContents();
        router.replace('/home');
    };

    const confirmDelete = () => {
        Alert.alert(
            "Delete Configuration?",
            "Are you sure you want to delete this configuration? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: deleteConfig },
            ]
        );
    };

    const deleteConfig = () => {
        deleteConfiguration(configID);
        logDatabaseContents();
        router.replace('/home'); // Go back to the home screen
    };

    const goBack = () => {
        router.replace('/home');
    };

    const isSaveDisabled = !configName.trim() || devices.length === 0;

    
    return (
        <View  //all
          style={{ 
            flex: 1, 
            //backgroundColor: "$bg" 
          }}
          backgroundColor="$bg"
        >

        {/* Top Bar with Back Button */}
        <XStack 
                height={80} 
                backgroundColor="#3E0094" 
                alignItems="center" 
                paddingHorizontal={10} 
                paddingTop={20} 
                justifyContent="space-between"
            >
                {/* Back Button */}
                <Button
                    icon={<ArrowLeftSquare size={32} />}
                    backgroundColor="transparent"
                    color="white"
                    onPress={goBack}
                    padding={10}
                />

                {/* App Logo */}
                <Image 
                    source={require("@/assets/images/horizontalPinkLogo.png")}
                    style={{ width: 100, height: 40, resizeMode: "contain" }}
                />

                {/* Spacer (To Center Logo Properly) */}
                <View style={{ width: 40 }} />
            </XStack>

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
                                onPress={() => removeDevice(device.id)}
                            >
                                
                            </Button>
                        </XStack>
                    ))
                )}
            </ScrollView>

            <XStack justifyContent="space-between" paddingHorizontal={20} marginTop={100} width="100%">
    {/* Button to Insert Dummy Data */}
    <Button 
        fontSize={10}
        onPress={insertDummyData} 
        backgroundColor="#3E0094"
        color="white"
        borderRadius={5}
        padding={15}
        width="48%"
    >
        DEMO: Insert Dummy Data
    </Button>

    {/* Delete Configuration Button */}
    <Button 
        onPress={confirmDelete} 
        backgroundColor="#FF0055"
        color="white"
        borderRadius={5}
        padding={15}
        width="48%"
    >
        Delete Configuration
    </Button>
</XStack>

        

         {/* Save Button - Disabled if configName is empty */}
         <Button 
                onPress={saveChanges} 
                backgroundColor={!isSaveDisabled ? "#3E0094" : "#CCCCCC"} 
                color="white"
                disabled={isSaveDisabled}
                borderRadius={0}  // Makes it stretch full width
                position="absolute"
                bottom={0}
                width="100%"
                height={60}
                justifyContent="center"
                fontSize={32}
            >
                Save
            </Button>

               
        
        
        </View> //all
    );
}


                