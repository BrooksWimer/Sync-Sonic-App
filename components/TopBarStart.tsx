// components/TopBar.tsx
import { useTheme, useThemeName, XStack, YStack } from 'tamagui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Platform } from 'react-native';




export const TopBarStart = () => {
  const router = useRouter()

  const themeName = useThemeName();
    const theme = useTheme();
  
  
    const logo = themeName === 'dark'
    ? require('../assets/images/horizontalLogoDark.png')
    : require('../assets/images/horizontalLogoLight.png')
  
    const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
    const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
    const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
    const nc = themeName === 'dark' ? '#F2E8FF' : '#26004E'


    //if android
    let h = 70
    let pt = 0
    //else, 
    if (Platform.OS === 'ios') {
      h = 80;
      pt = 25
    }

  return (
    <XStack
      height={h}
      style={{
        backgroundColor: pc,
        paddingTop: pt
      }}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$4"
      >
      <Image
        source={logo}
        style={{ height: 24, resizeMode: 'contain', alignSelf: 'center'}}
        
      />
    </XStack>
  )
}