import React from 'react';
import { View } from 'react-native';
import { H1, useThemeName } from 'tamagui';

type HeaderProps = {
  title: string;
};

export const Header = ({ title }: HeaderProps) => {
  const themeName = useThemeName();

  const bg = themeName === 'dark' ? '#250047' : '#F2E8FF';
  const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E';

  return (
    <View
      style={{
        paddingTop: 20,
        paddingBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        paddingHorizontal: 20,
      }}
    >
      <H1
        style={{
          color: tc,
          fontFamily: 'Finlandica-Medium',
          fontSize: 40,
          lineHeight: 44,
          marginBottom: 5,
          marginTop: 15,
          letterSpacing: 1,
        }}
      >
        {title}
      </H1>
    </View>
  );
};
