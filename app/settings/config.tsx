import { addSpeaker, getSpeakers, addConfiguration, logDatabaseContents, updateConfiguration, deleteSpeakerById, updateSpeakerConnectionStatus } from '@/utils/database';
import { Button, H1, YStack, Input, ScrollView } from "tamagui";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback } from 'react';
import { Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { TopBar } from '@/components/topbar-variants/TopBar';
import { BottomButton } from '@/components/buttons/BottomButton';
import { Header } from '@/components/texts/TitleText';
import { DeviceCard } from '@/components/cards/DeviceCard';
import { useAppColors } from '@/styles/useAppColors';

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
            console.log("fire")
            deleteSpeakerById(device.id);
        }
        
        // Just update the local state to remove the device - no backend calls
        setDevices(prevDevices => prevDevices.filter(d => d.id !== device.id));
        console.log("local fire")
    };
    // updating the DB when creating a new configuration.
    const saveChanges = () => {
        if (!configName.trim() || devices.length === 0) return;
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
        
        // Route to SpeakerConfigScreen instead of home
        router.replace({ 
            pathname: '/SpeakerConfigScreen', 
            params: { 
                configID: configID.toString(), 
                configName 
            } 
        });
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

    const { bg, pc, tc, stc} = useAppColors();







    return (
        <YStack flex={1} backgroundColor={bg as any}>
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
                    color={tc as any}
                    borderWidth={1}
                    borderColor={stc as any}
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
                    backgroundColor={pc as any}
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
                    <H1 style={{ color: stc, fontFamily: "Finlandica", letterSpacing: 1 }} alignSelf="center">
                    No devices connected. Please connect devices
                    </H1>
                ) : (
                    devices.map((device) => (
                    <DeviceCard
                        key={device.id}
                        device={device}
                        onRemove={() => removeDevice(device)}
                    />
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