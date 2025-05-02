import React from 'react';
import { Text } from 'tamagui';
import { useAppColors } from '../../styles/useAppColors';

type BodyProps = {
  children: React.ReactNode;
  center?: boolean;
  bold?: boolean;
  style?: object;
};

export const Body = ({ children, center = true, bold = false, style = {} }: BodyProps) => {
  const { tc } = useAppColors();

  return (
    <Text
      style={[
        {
          color: tc,
          fontFamily: bold ? 'Inter-Bold' : 'Inter-Regular',
        },
        style,
      ]}
      fontSize={16}
      textAlign={center ? 'center' : 'left'}
      paddingHorizontal={center ? 10 : 0}
    >
      {children}
    </Text>
  );
};
