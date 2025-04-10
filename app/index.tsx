import { YStack, Button, H1, Image, useThemeName, useTheme } from "tamagui";
import { router } from "expo-router";
import { useEffect } from 'react';
import { setupDatabase } from "./database";
import { TopBar } from "../components/TopBar";
import { TopBarStart } from "../components/TopBarStart";
import colors from '../assets/colors/colors';
//import {} from '../utils/functions';
import {PI_API_URL} from '../utils/constants';


export default function Index() {
  useEffect(() => {
    setupDatabase();
  }, []);


  const sendHome = () => {
    console.log('');
    router.push('./home');
  };

  const themeName = useThemeName();
  const theme = useTheme();

  const imageSource = themeName === 'dark'
    ? require('../assets/images/welcomeGraphicDark.png')
    : require('../assets/images/welcomeGraphicLight.png')

  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
  const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'

  return (
    <YStack
      flex={1}
      style={{ backgroundColor: bg }}
      justifyContent="space-between"
      //padding="$4"
    >
      <TopBar/>

      {/* Middle Content */}
      <YStack alignItems="center" paddingTop="$4">
        <H1
          style={{ color: tc }}
          fontFamily="Finlandica"
          fontSize={36}
          lineHeight={44}
          fontWeight="700"
        >
          Welcome
        </H1>

        <Image
          source={imageSource}
          style={{ width: 250, height: 250, marginBottom: 40 }}
          resizeMode="contain"
        />
      </YStack>

      {/* Bottom Button */}
      <Button
      
        onPress={sendHome}
        style={{
          
          backgroundColor: pc,
          width: '90%',
          height: 50,
          borderRadius: 999,
          marginBottom: 10,
          alignSelf: 'center',
        }}


        pressStyle={{ opacity: 0.8 }}
      >
        <H1 color="white" fontSize={18}>
          Connect to Box
        </H1>
      </Button>
    </YStack>
  )
}
