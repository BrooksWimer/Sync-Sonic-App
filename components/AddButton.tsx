import { TouchableOpacity, Image, View } from 'react-native'
import { GestureResponderEvent } from 'react-native'
import { useTheme, useThemeName } from 'tamagui';

type AddButtonProps = {
  onPress?: (event: GestureResponderEvent) => void
}


//NOT NEEDED

export const AddButton = ({ onPress }: AddButtonProps) => {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 32,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        style={{
          width: 60,
          height: 60,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={onPress} // 👈 use the passed-in handler
      >
        <Image
          source={require('../assets/images/greenAdd.png')}
          style={{ width: 50, height: 50, tintColor: '#00FF6A' }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  )
}