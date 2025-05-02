// components/FloatingAddButton.tsx
import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { CirclePlus } from '@tamagui/lucide-icons';
import { useAppColors } from '@/styles/useAppColors';

type Props = {
  onPress: () => void;
};

export const FloatingAddButton = ({ onPress }: Props) => {
  const { green } = useAppColors();
  const g = green as any;

  const iosBuffer = Platform.OS === 'ios' ? 20 : 0;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 15 + iosBuffer,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={{
          width: 60,
          height: 60,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CirclePlus size={60} strokeWidth={1} color={g} />
      </TouchableOpacity>
    </View>
  );
};
