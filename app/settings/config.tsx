import { SquareX, ArrowLeftSquare } from '@tamagui/lucide-icons'
import { addSpeaker, getSpeakers, deleteSpeaker, addConfiguration, logDatabaseContents, updateConfiguration, deleteSpeakerById, deleteConfiguration } from '../database';
import { Button, H1, YStack, View, Input, Label, ScrollView, XStack } from "tamagui";
import { router } from "expo-router";
import { useState, useEffect } from 'react';
import { Alert, Image, Linking, PermissionsAndroid, Platform } from "react-native";
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
//import { BleManager } from 'react-native-ble-plx';


export default function Config() {
    const params = useLocalSearchParams();
    const configID: number = Number(params.configID)
    const initialConfigName = params.configName ? params.configName.toString() : "";
    const editHeader: String = "Edit Configuration"; // change on function
    const createHeader: String = "Create Configuration";
    const [configName, setConfigName] = useState(initialConfigName);
    const [devices, setDevices] = useState<{ id: number, name: string, mac: string }[]>([]);
    const [deletedSpeakers, setDeletedSpeakers] = useState<number[]>([]); // Track speakers to delete

    useEffect(() => {
        console.log("DB pull")
        setDevices(getSpeakers(configID));
    }, [configID]);

    const openSettings = () => {
        console.log("opening app system settings")
        Linking.openSettings(); // Opens system settings 
    };

    useEffect(() => {
        console.log("updating speaker for config: " + configID)
        setDevices(getSpeakers(configID));
    }, [configID]);

    useEffect(() => {
        console.log("fetching speakers")
        getSpeakers(configID, setDevices);
    }, [configID]);

    // Function to insert dummy data
    const insertDummyData = () => {
        console.log("inserting fake data into visible list")
        const dummyDevices = [
            { id: 0, name: "JBL abc", mac: "B8-BF-8F-61-BC-EE" },
            { id: 1, name: "Sony def", mac: "C5-AE-2C-73-F0-A7" },
            { id: 2, name: "Sonos ghi", mac: "5D-8D-1C-30-BD-8C" }
        ];
        setDevices(dummyDevices);
    };

    const removeDevice = (id: number) => {
        console.log("removed " + id + " from list")
        setDeletedSpeakers(prev => [...prev, id]); // Mark for deletion
        setDevices(prevDevices => prevDevices.filter(device => device.id !== id));
    };

    // updating the DB
    const saveChanges = () => {
        if (!configName.trim() || devices.length === 0) return; // don't save without name or devices
        if (configID) {
            // change name from textbox
            console.log("name is: " + configName)
            updateConfiguration(configID, configName);

            // remove speakers
            deletedSpeakers.forEach(speakerId => deleteSpeakerById(speakerId));

            // set new speakers
            devices.forEach(device => {
                if (!device.id) {
                    console.log("adding speaker: " + device.name)
                    addSpeaker(configID, device.name, device.mac);
                }
            });
        } else {
            // create new configuration
            addConfiguration(configName, (newConfigID) => {
                devices.forEach(device => addSpeaker(newConfigID, device.name, device.mac));
                console.log("New config: " + configName + ":" + configID)
            });
        }

        logDatabaseContents();
        router.replace('/home'); // send back
    };

    const confirmDelete = () => { // full config
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
        console.log("deleting config " + configID)
        logDatabaseContents();
        router.replace('/home'); // go back to the home screen
    };

    const goBack = () => {
        router.replace('/home');
    };

    const isSaveDisabled = !configName.trim() || devices.length === 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "$bg" }}>
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

                {/* Select Devices */}
                <Button 
                    onPress={() => router.push({ pathname: '/DeviceSelectionScreen', params: { configName } })}
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
                                <H1 style={{ fontWeight: "bold" }} fontSize={16}>{device.name}</H1>
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
        </SafeAreaView>
    );
}
