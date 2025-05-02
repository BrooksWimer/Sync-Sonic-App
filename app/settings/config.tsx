import { SquareX, ArrowLeftSquare, Wifi } from '@tamagui/lucide-icons'
import { addSpeaker, getSpeakers, deleteSpeaker, addConfiguration, logDatabaseContents, updateConfiguration, deleteSpeakerById, deleteConfiguration, updateSpeakerConnectionStatus } from '@/utils/database';
import { Button, H1, YStack, View, Input, Label, ScrollView, XStack, useThemeName, useTheme } from "tamagui";
import { router, useFocusEffect } from "expo-router";
import { useState, useEffect, useCallback } from 'react';
import { Alert, Image, Linking, PermissionsAndroid, Platform } from "react-native";
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '@/components/TopBar';
import * as Font from 'expo-font';
import { BottomButton } from '@/components/BottomButton';
import { Header } from '@/components/TitleText';

export default function Config() {
    const params = useLocalSearchParams();
    const configID: number = Number(params.configID);
    const initialConfigName = params.configName ? params.configName.toString() : "";
    const editHeader: string = "Edit Configuration";
    const createHeader: string = "Create Configuration";
    const [configName, setConfigName] = useState(initialConfigName);
    const [devices, setDevices] = useState<{ id: number, name: string, mac: string }[]>([]);
    const [deletedSpeakers, setDeletedSpeakers] = useState<number[]>([]); // Track speakers to delete
    
    let abuffer = 20
    let iosbuffer=0
    //else, 
    if (Platform.OS === 'ios') {
        abuffer = 0
        iosbuffer=20
    }

    // Only load speakers when we have a valid configID
    useFocusEffect(
        useCallback(() => {
            if (configID && !isNaN(configID)) {
                console.log("DB pull for config:", configID);
                setDevices(getSpeakers(configID));
            }
        }, [configID])
    );
    // DEV Function to insert dummy data
    const insertDummyData = () => {
        console.log("inserting fake data into visible list")
        const dummyDevices = [
            { id: 0, name: "JBL abc", mac: "B8-BF-8F-61-BC-EE" },
            { id: 1, name: "Sony def", mac: "C5-AE-2C-73-F0-A7" },
            { id: 2, name: "Sonos ghi", mac: "5D-8D-1C-30-BD-8C" }
        ];
        setDevices(dummyDevices);
    };
    // In edit mode, immediately remove a speaker:
    // Update the DB, and call the backend disconnect endpoint for that speaker.
    const removeDevice = async (device: { id: number, name: string, mac: string }) => {
        console.log("Removing device " + device.id);
        // If editing an existing configuration, update the DB immediately.
        if (configID) {
            deleteSpeakerById(device.id);
        }
        // Just update the local state to remove the device - no backend calls
        setDevices(prevDevices => prevDevices.filter(d => d.id !== device.id));
    };
    // updating the DB when creating a new configuration.
    const saveChanges = () => {
        if (!configName.trim() || devices.length === 0) return; // don't save without name or devices
        if (configID) {
            // In edit mode, configuration updates happen immediately on deletion.
            console.log("Updating configuration name: " + configName);
            updateConfiguration(configID, configName);
        } else {
            // Create new configuration
            addConfiguration(configName, (newConfigID) => {
                devices.forEach(device => addSpeaker(newConfigID, device.name, device.mac));
                devices.forEach(device => updateSpeakerConnectionStatus(newConfigID, device.mac, true))
                console.log("New config: " + configName + ":" + newConfigID);
            });
        }
        logDatabaseContents();
        router.replace('/home'); // navigate back to home
    };
    // The "Find Bluetooth Devices" button is now conditionally labeled.
    // When editing, it becomes "Add Bluetooth Devices".
    const onSelectDevicesPress = () => {
        // Pass along current devices (existing configuration speakers)
        router.replace({
            pathname: '/DeviceSelectionScreen',
            params: {
                configID: configID.toString(),
                configName,
                existingDevices: JSON.stringify(devices)
            }
        });
    };
    const [isSaveDisabled, setIsSaveDisabled] = useState(true);
    useFocusEffect(
        useCallback(() => {
            const disabled = !configName.trim() || devices.length === 0;
            setIsSaveDisabled(disabled);
        }, [configName, devices])
    );
    const themeName = useThemeName();
    const theme = useTheme();
    const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
    const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
    const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
    const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'
    const dc = themeName === 'dark' ? 'white' : '#26004E'
    return (
        <YStack flex={1} backgroundColor={bg}>
            {/* Top Bar with Back Button -----------------------------------------------------------------*/}
            <TopBar/>
            {/* Header -----------------------------------------------------------------------------------*/}
            <Header title={editHeader}/>
                
            {/* Configuration Name Input Field ------------------------------------------------------------*/}
            <YStack marginHorizontal={20} marginTop={1} gap={10}>
                <H1
                    style={{ color: tc, fontFamily: "Finlandica" }}
                    alignSelf='center'
                    fontSize={18}
                    lineHeight={44}
                    letterSpacing={1}
                    fontWeight="400">
                    Configuration Name:
                </H1>
                <Input
                    id="configName"
                    value={configName}
                    onChangeText={setConfigName}
                    placeholder="Name"
                    placeholderTextColor={stc}
                    color={tc}
                    borderWidth={1}
                    borderColor={stc}
                    borderRadius={12}
                    padding={10}
                    fontSize={16}
                    fontFamily="Finlandica"
                    letterSpacing={1}
                    maxLength={20}
                />
                {/* Configuration Name Input Field ------------------------------------------------------------*/}



                {/* Select Devices Button ---------------------------------------------------------------------*/}
                <Button
                    onPress={onSelectDevicesPress}
                    onLongPress={() => insertDummyData()}
                    backgroundColor={pc}
                    color="white"
                    borderRadius={5}
                    padding={10}
                >
                    <H1 style={{ fontFamily: "Inter", color: "white" }}>
                        {configID ? "Add Bluetooth Devices" : "Find Bluetooth Devices"}
                    </H1>
                </Button>
                {/* Select Devices Button ---------------------------------------------------------------------*/}
            </YStack>



            {/* List of Added Bluetooth Devices ---------------------------------------------------------------------*/}
            <ScrollView style={{ maxHeight: 300, marginTop: 10, paddingHorizontal: 20 }}>
            {devices.length === 0 ? (
                <H1 style={{ color: stc, fontFamily: "Finlandica", letterSpacing:1 }} alignSelf="center">
                    No devices connected. Please connect devices
                </H1>
            ) : (
                devices.map((device) => (
                <YStack
                    key={device.id}
                    borderWidth={1}
                    borderColor={stc}
                    borderRadius={12}
                    padding={12}
                    marginBottom={10}
                    backgroundColor="transparent"
                >
                    <XStack justifyContent="space-between" alignItems="center">
                        {/* Left block: text lines stacked vertically */}
                        <YStack flex={1}>
                            <H1
                            style={{
                                fontSize: 16,
                                fontWeight: "600",
                                color: tc,
                                fontFamily: "Finlandica",
                            }}
                            >
                            {device.name}
                            </H1>
                            <XStack alignItems="center" marginTop={6}>
                            <Wifi size={20} color={tc} style={{ marginRight: 8 }} />
                            <H1
                                style={{
                                fontSize: 12,
                                color: tc,
                                marginLeft: 6,
                                fontFamily: "Finlandica",
                                }}
                            >
                                {device.mac}
                            </H1>
                            </XStack>
                        </YStack>
                        {/* Right side: Delete button vertically centered */}
                        <Button
                            size={50}
                            backgroundColor="transparent"
                            onPress={() => removeDevice(device)}
                            padding={0}
                            height={50} // match visual height of the text block
                            minWidth={40}
                            alignItems="center"
                            justifyContent="center"
                            icon={<SquareX size={24} strokeWidth={1} color={dc} />}
                        />
                    </XStack>
                </YStack>
                ))
            )}
            </ScrollView>
            {/* List of Added Bluetooth Devices ---------------------------------------------------------------------*/}
            
            {/* Save Button---------------------------------------------------------------------*/}
            <BottomButton
            text="Save"
            onPress={saveChanges}
            disabled={isSaveDisabled}
            />
            {/* Save ---------------------------------------------------------------------*/}

        </YStack>
    );
}