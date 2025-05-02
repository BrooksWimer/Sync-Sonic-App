// components/DeviceCard.tsx
import { H1, YStack, XStack, Button } from 'tamagui';
import { Wifi, SquareX } from '@tamagui/lucide-icons';
import { useAppColors } from '../styles/useAppColors';

export const DeviceCard = ({ device, onRemove }: { device: any, onRemove: () => void }) => {
  const { bg, tc, stc } = useAppColors();
  const iconColor = tc as any;


  return (
    <YStack
      borderWidth={1}
      style={{ borderColor: stc }}
      borderRadius={12}
      padding={12}
      marginBottom={10}
      backgroundColor="transparent"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <YStack flex={1}>
          <H1
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: tc,
              fontFamily: 'Finlandica',
            }}
          >
            {device.name}
          </H1>
          <XStack alignItems="center" marginTop={6}>
            <Wifi size={20} color={iconColor} style={{ marginRight: 8 }} />
            <H1
              style={{
                fontSize: 12,
                color: tc,
                marginLeft: 6,
                fontFamily: 'Finlandica',
              }}
            >
              {device.mac}
            </H1>
          </XStack>
        </YStack>
        <Button
          size={50}
          backgroundColor="transparent"
          onPress={onRemove}
          padding={0}
          height={50}
          minWidth={40}
          alignItems="center"
          justifyContent="center"
          icon={<SquareX size={24} strokeWidth={1} color={iconColor}  />}
        />
      </XStack>
    </YStack>
  );
};
