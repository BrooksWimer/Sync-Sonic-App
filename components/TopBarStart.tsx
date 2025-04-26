// components/TopBar.tsx
import { useTheme, useThemeName, XStack, YStack } from 'tamagui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { Image, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const TopBarStart = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const baseHeight = Platform.OS === 'ios' ? 50 : 70

  const themeName = useThemeName();
    const theme = useTheme();
  
  
    const logo = themeName === 'dark'
    ? require('../assets/images/horizontalLogoDark.png')
    : require('../assets/images/horizontalLogoLight.png')
  
    const bg = themeName === 'dark' ? '#250047' : '#F2E8FF'
    const pc = themeName === 'dark' ? '#E8004D' : '#3E0094'
    const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E'
    const nc = themeName === 'dark' ? '#F2E8FF' : '#26004E'

  return (
    <XStack
      height={baseHeight + insets.top}
      style={{
        backgroundColor: pc,
        paddingTop: insets.top
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
