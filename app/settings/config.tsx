import { SquareX, ArrowLeftSquare, Wifi } from '@tamagui/lucide-icons'
import { addSpeaker, getSpeakers, deleteSpeaker, addConfiguration, logDatabaseContents, updateConfiguration, deleteSpeakerById, deleteConfiguration, updateSpeakerConnectionStatus } from '../database';
import { Button, H1, YStack, View, Input, Label, ScrollView, XStack, useThemeName, useTheme } from "tamagui";
import { router, useFocusEffect } from "expo-router";
import { useState, useEffect, useCallback } from 'react';
import { Alert, Image, Linking, PermissionsAndroid, Platform } from "react-native";
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '@/components/TopBar';
import { PI_API_URL } from '../../utils/constants';
import { removeDevice, saveChanges } from '@/utils/ConfigurationFunctions';


export default function Config() {
    const params = useLocalSearchParams();
    const configID: number = Number(params.configID);
    const initialConfigName = params.configName ? params.configName.toString() : "";
    const editHeader: string = "Edit Configuration";
    const createHeader: string = "Create Configuration";
    const [configName, setConfigName] = useState(initialConfigName);
    const [devices, setDevices] = useState<{ id: number, name: string, mac: string }[]>([]);
    const [deletedSpeakers, setDeletedSpeakers] = useState<number[]>([]); // Track speakers to delete

    useFocusEffect(
        useCallback(() => {
          console.log("DB pull");
          setDevices(getSpeakers(configID));
        }, [configID])
      );

    useEffect(() => {
        console.log("updating speaker for config: " + configID)
        setDevices(getSpeakers(configID));
    }, [configID]);

    useEffect(() => {
        console.log("fetching speakers")
        getSpeakers(configID);
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
      
    

    return (
        <YStack flex={1} backgroundColor={bg}>
            {/* Top Bar with Back Button */}
            <TopBar/>

            {/* Header */}
            <View style={{
                paddingTop: 20,
                paddingBottom: 10,
                alignItems: "center",
            }}>
                <H1 style={{ fontSize: 32, fontWeight: "bold", color: tc }}>{editHeader}</H1>
            </View>

            {/* Configuration Name Input Field */}
            <YStack marginHorizontal={20} marginTop={1} gap={10}>
                <H1
                          style={{ color: tc }}
                          alignSelf='center'
                          fontFamily="Finlandica"
                          fontSize={15}
                          lineHeight={44}
                          fontWeight="400">
                          Configuration Name
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
                />

                {/* Select Devices */}
                <Button 
                    onPress={onSelectDevicesPress}
                    onLongPress={() => insertDummyData()}
                    backgroundColor={pc}
                    color="white"
                    borderRadius={5}
                    padding={10}
                >
                    <H1>
                        {configID ? "Add Bluetooth Devices" : "Find Bluetooth Devices"}
                    </H1>
                </Button>
            </YStack>

            {/* List of Found Bluetooth Devices */}
            <ScrollView style={{ maxHeight: 300, marginTop: 10, paddingHorizontal: 20 }}>
            {devices.length === 0 ? (
                <H1 color={stc} alignSelf="center">
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
                    <H1 fontSize={16} fontWeight="600" color={tc}>
                        {device.name}
                    </H1>
                    <Button
                        size="$2"
                        backgroundColor="transparent"
                        onPress={() => removeDevice(device, configID, configName, devices, setDevices)}
                        padding={0}
                        icon={<SquareX size={25} color="white" />}
                    />
                    </XStack>

                    <XStack alignItems="center" marginTop={6}>
                    <Wifi size={20} color={tc} style={{ marginRight: 8 }} />
                    <H1 fontSize={12} color={tc} marginLeft={6}>
                        {device.mac}
                    </H1>
                    </XStack>
                </YStack>
                ))
            )}
            </ScrollView>

        {/* Bottom Button */}
        <Button
        onPress={() => saveChanges(configID, configName, devices, router)}
        disabled={isSaveDisabled}
        style={{
            backgroundColor: pc,
            width: '90%',
            height: 50,
            borderRadius: 999,
            marginBottom: 5,
            marginTop: 50,
            alignSelf: 'center',
            opacity: !isSaveDisabled ? 1 : 0.5, // 👈 dim when invalid
        }}
        pressStyle={{ opacity: !isSaveDisabled ? 0.8 : 0.5 }} // keep it dim if disabled
        >
        <H1 color="white" fontSize={18}>
            Save
        </H1>
</Button>

        </YStack>
    );
}
