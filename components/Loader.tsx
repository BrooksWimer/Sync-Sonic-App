import React from 'react';
import { ActivityIndicator, ViewStyle } from 'react-native';
import { useAppColors } from '../styles/useAppColors';

type LoaderProps = {
  size?: number | 'small' | 'large';
  style?: ViewStyle;
};

export const Loader = ({ size = 'small', style = {} }: LoaderProps) => {
  const { pc } = useAppColors();

  return <ActivityIndicator size={size} color={pc} style={style} />;
};
