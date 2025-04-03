import { SquareX, ArrowLeftSquare } from '@tamagui/lucide-icons'
import { addSpeaker, getSpeakers, deleteSpeaker, addConfiguration, logDatabaseContents, updateConfiguration, deleteSpeakerById, deleteConfiguration } from '../database';
import { Button, H1, YStack, View, Input, Label, ScrollView, XStack, useThemeName, useTheme } from "tamagui";
import { router } from "expo-router";
import { useState, useEffect } from 'react';
import { Alert, Image, Linking, PermissionsAndroid, Platform, StyleSheet } from "react-native";
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Config() {
    const params = useLocalSearchParams();
    const configID: number = Number(params.configID);
    const initialConfigName = params.configName ? params.configName.toString() : "";
    const editHeader: string = "Edit Configuration";
    const createHeader: string = "Create Configuration";
    const [configName, setConfigName] = useState(initialConfigName);
    const [devices, setDevices] = useState<{ id: number, name: string, mac: string }[]>([]);
    const [deletedSpeakers, setDeletedSpeakers] = useState<number[]>([]); // Track speakers to delete

    useEffect(() => {
        console.log("DB pull");
        setDevices(getSpeakers(configID));
    }, [configID]);

    const openSettings = () => {
        console.log("opening app system settings");
        Linking.openSettings(); // Opens system settings 
    };

    useEffect(() => {
        console.log("updating speaker for config: " + configID);
        setDevices(getSpeakers(configID));
    }, [configID]);

    useEffect(() => {
        console.log("fetching speakers");
        getSpeakers(configID);
    }, [configID]);

    // Function to insert dummy data (for testing)
    const insertDummyData = () => {
        console.log("inserting fake data into visible list");
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
        // Build payload to disconnect only this speaker.
        const payload = {
            configID: configID,
            configName: configName,
            speakers: { [device.mac]: device.name },
            settings: {} // Assuming no settings needed for disconnecting a single speaker.
        };
        try {
            const response = await fetch("http://10.0.0.89:3000/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const result = await response.json();
            console.log("Disconnect result:", result);
        } catch (error) {
            console.error("Error disconnecting device:", error);
            Alert.alert("Error", "There was an error disconnecting the device.");
        }
        // Update the local state to remove the device.
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
                console.log("New config: " + configName + ":" + newConfigID);
            });
        }
        logDatabaseContents();
        router.replace('/home'); // navigate back to home
    };

    const confirmDelete = () => { // delete entire configuration
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
        console.log("deleting config " + configID);
        logDatabaseContents();
        router.replace('/home'); // go back to the home screen
    };

    const goBack = () => {
        router.replace('/home');
    };

    // The "Find Bluetooth Devices" button is now conditionally labeled.
    // When editing, it becomes "Add Bluetooth Devices".
    const onSelectDevicesPress = () => {
        // Pass along current devices (existing configuration speakers)
        router.push({
            pathname: '/DeviceSelectionScreen',
            params: { 
                configID: configID.toString(), 
                configName, 
                existingDevices: JSON.stringify(devices) 
            }
        });
    };

    const isSaveDisabled = !configName.trim() || devices.length === 0;

    const themeName = useThemeName();
    const theme = useTheme();
    
    const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
    const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
    const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
    const stc = themeName === 'dark' ? '#9D9D9D' : '#9D9D9D'

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <XStack 
                height={80} 
                backgroundColor={pc}
                alignItems="center" 
                paddingHorizontal={10} 
                paddingTop={20} 
                justifyContent="space-between"
            >
                <Button
                    icon={<ArrowLeftSquare size={32} />}
                    backgroundColor="transparent"
                    color="white"
                    onPress={goBack}
                    padding={10}
                />
                <Image 
                    source={require("@/assets/images/horizontalPinkLogo.png")}
                    style={{ width: 100, height: 40, resizeMode: "contain" }}
                />
                <View style={{ width: 40 }} />
            </XStack>

            <View style={styles.header}>
                <H1 style={[styles.headerText, { color: tc }]}>
                    {configID ? editHeader : createHeader}
                </H1>
            </View>

            <YStack style={styles.content}>
                <Label htmlFor="configName" style={[styles.label, { color: tc }]}>
                    Configuration Name:
                </Label>
                <Input
                    id="configName"
                    value={configName}
                    onChangeText={setConfigName}
                    placeholder="Enter configuration name"
                    placeholderTextColor={stc}
                    style={[styles.input, { 
                        color: tc,
                        borderColor: pc,
                        backgroundColor: '#9D9D9D'
                    }]}
                />

                <Button 
                    onPress={onSelectDevicesPress}
                    style={[styles.button, { backgroundColor: pc }]}
                >
                    <H1 style={styles.buttonText}>
                        {configID ? "Add Bluetooth Devices" : "Find Bluetooth Devices"}
                    </H1>
                </Button>
            </YStack>

            <ScrollView style={styles.deviceList}>
                {devices.length === 0 ? (
                    <H1 style={[styles.emptyText, { color: stc }]}>
                        No devices connected. Please connect devices.
                    </H1>
                ) : (
                    devices.map((device) => (
                        <XStack 
                            key={device.id}
                            style={[styles.deviceCard, { borderColor: stc }]}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            <View>
                                <H1 style={[styles.deviceName, { color: tc }]}>{device.name}</H1>
                                <H1 style={[styles.macAddress, { color: tc }]}>{device.mac}</H1>
                            </View>
                            <Button
                                icon={<SquareX size={20} />}
                                backgroundColor="#FF0055"
                                color="white"
                                borderRadius={5}
                                onPress={() => removeDevice(device)}
                            /> 
                        </XStack>
                    ))
                )}
            </ScrollView>

            {!configID && (
                <Button
                    onPress={saveChanges}
                    disabled={isSaveDisabled}
                    style={[styles.saveButton, { 
                        backgroundColor: pc,
                        opacity: isSaveDisabled ? 0.5 : 1
                    }]}
                >
                    <H1 style={styles.saveButtonText}>Save Changes</H1>
                </Button>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 20,
        paddingBottom: 10,
        alignItems: "center",
    },
    headerText: {
        fontSize: 32,
        fontWeight: "bold",
        fontFamily: "Finlandica"
    },
    content: {
        marginHorizontal: 20,
        marginTop: 10,
        gap: 10
    },
    label: {
        fontSize: 18,
        fontFamily: "Finlandica"
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        fontSize: 16,
        fontFamily: "Finlandica"
    },
    button: {
        borderRadius: 5,
        padding: 10,
        alignItems: 'center'
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontFamily: "Finlandica"
    },
    deviceList: {
        maxHeight: 200,
        marginTop: 10,
        paddingHorizontal: 20
    },
    deviceCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: 'transparent'
    },
    deviceName: {
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "Finlandica"
    },
    macAddress: {
        fontSize: 12,
        fontFamily: "Finlandica"
    },
    emptyText: {
        alignSelf: "center",
        fontFamily: "Finlandica"
    },
    saveButton: {
        marginHorizontal: 20,
        marginTop: 20,
        borderRadius: 5,
        padding: 10,
        alignItems: 'center'
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontFamily: "Finlandica"
    }
});
