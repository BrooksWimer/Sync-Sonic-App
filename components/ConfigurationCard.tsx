import { Pressable, Platform, Alert, Text, TouchableOpacity } from 'react-native';
import { Button, YStack, XStack, View } from 'tamagui';
import { Pencil } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { useAppColors } from '@/styles/useAppColors';
import * as Haptics from 'expo-haptics';
import { useCustomFonts } from '@/utils/fonts';
import { useState } from 'react';

type Props = {
  config: {
    id: number;
    name: string;
    speakerCount: number;
    isConnected: number;
  };
  index: number;
  speakerStatuses: boolean[];
  onDelete: () => void;
};

export const ConfigurationCard = ({ config, index, speakerStatuses, onDelete }: Props) => {
  const router = useRouter();
  const { bg, tc, green } = useAppColors();
  const fontsLoaded = useCustomFonts();
  const [isPressed, setIsPressed] = useState(false);

  if (!fontsLoaded) return null;

  const handlePress = () => {
    router.push({
      pathname: '/SpeakerConfigScreen',
      params: {
        configID: config.id.toString(),
        configName: config.name,
      },
    });
  };

  const handleLongPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Alert.alert(
      'Delete Configuration?',
      `Are you sure you want to delete "${config.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={{
        borderRadius: 15,
        padding: 15,
        marginBottom: '5%',
        borderWidth: 1,
        borderColor: tc,
        backgroundColor: bg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: index === 0 ? 15 : 0,
        transform: [{ scale: isPressed ? 1.03 : 1 }],
        overflow: 'hidden',
      }}
    >
      <YStack>
        <Text
          style={{
            fontSize: 18,
            color: tc,
            fontFamily: 'Finlandica-Medium',
          }}
        >
          {config.name}
        </Text>

        <XStack marginTop={4}>
          {speakerStatuses.map((connected, i) => (
            <View
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                marginRight: 6,
                backgroundColor: connected ? green : '#FF0055',
                shadowColor: tc,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
                elevation: 8,
              }}
            />
          ))}
        </XStack>

        <Text
          style={{
            fontSize: 14,
            color: config.isConnected ? green : '#FF0055',
            marginTop: 6,
            fontFamily: 'Finlandica-Medium',
            letterSpacing: 1,
          }}
        >
          {config.isConnected ? 'Connected' : 'Not Connected'}
        </Text>
      </YStack>

      <TouchableOpacity
        onPress={() =>
            router.push({
            pathname: '/settings/config',
            params: {
                configID: config.id.toString(),
                configName: config.name,
            },
            })
        }
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} // expand tap area
        style={{
            padding: 4, // visual padding
            borderRadius: 999,
            justifyContent: 'center',
            alignItems: 'center',
        }}
        >
        <Pencil size={20} color={tc as any} />
        </TouchableOpacity>

    </Pressable>
  );
};
