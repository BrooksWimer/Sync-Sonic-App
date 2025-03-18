
// import { Stack } from 'expo-router'; ///////// ?????
import { Plus, Pencil} from '@tamagui/lucide-icons'
import { Button, H1, YStack, View, XStack, ScrollView } from "tamagui";
import {useState, useEffect} from 'react';
import { Image } from "react-native";
import { useRouter } from 'expo-router';

import { getConfigurations, addConfiguration, resetDatabase} from './database';

export default function Home() {

    const router = useRouter(); //page changing
    const [configurations, setConfigurations] = useState<{ id: number, name: string, speakerCount: number }[]>([]);
    useEffect(() => {
        setConfigurations(getConfigurations()); // get config data
    }, []);


    const configID: number = 0;
    const addConfig = () => { //move to config settings with no populated data
        router.replace('/settings/config');
        params: { configID: (configID+1).toString() } //idk why this works but it does ..... [k]
        console.log("creating new configuration . . .")
    };

   //debug function for testing
    const clearDatabase = () => { 
        resetDatabase();
        //alert("Database reset!");
        console.log("Database Reset")
        router.replace('/home');
    };  



    return (
        <View  // wrapper
            style={{ 
                flex: 1, 
            }}
            backgroundColor="$bg" //page
        >

        {/* Top Bar */}
        <View style={{
            height: 80,
            backgroundColor: "#3E0094",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 20
        }}>
            <Image  // top logo
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
        <View style={{ //i theorize we don't even need this ......
                flex: 0.1,
                alignItems: "center",
                justifyContent: "center",
            }}>
        </View>

        {/* Configuration List */}
        <ScrollView style={{ paddingHorizontal: 20 }}>
        {configurations.length === 0 ? (
            <H1 style={{ textAlign: "center", color: "#666", marginVertical: 10 }}>
                    No configurations found.
            </H1>
            ) : (
            configurations.map((config) => (
            <XStack 
                key={config.id} 
                alignItems="center"
                backgroundColor="#1B1B1B"
                borderRadius={15}
                padding={15}
                marginBottom={10}
                borderWidth={1}
                borderColor="#3E0094"
                justifyContent="space-between"
                shadowColor="#93C7FF" // Glow color
                shadowOffset={{ width: 0, height: 0 }}
                shadowOpacity={0.8}
                shadowRadius={8} // Glow strength
                hoverStyle={{
                    shadowRadius: 15,
                    shadowOpacity: 1,
                    transform: [{ scale: 1.02 }] // Slightly enlarge on hover
                }}
                pressStyle={{
                    shadowRadius: 20,
                    transform: [{ scale: 1.04 }]
                }} //xstack opener end
                > 
                {/* Config Info */}
                <YStack>
                    <H1 style={{ fontSize: 18, fontWeight: "bold" }}>{config.name}</H1>
                    <H1 style={{ fontSize: 14, color: "#FFFFFF" }}> x {config.speakerCount} speakers</H1>
                </YStack>

                {/* Edit Button */}
                <Button
                    icon={<Pencil size={20} />}
                    backgroundColor="transparent"
                    onPress={() => router.push({
                                pathname: "/settings/config",
                                params: { configID: config.id.toString(), configName: config.name }
                    })} 
                    />
                        </XStack> 
                    ))
                )}
        </ScrollView>
        

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

        {/* Clear Database Button (Bottom Left) */}
        <Button 
            onPress={clearDatabase} 
            backgroundColor="red"
            fontSize={8}
            style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                width: 75,
                height: 32,
                borderRadius: 10,
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            clear db (testing)
        </Button>
        
        
        </View> //all
    );
}
