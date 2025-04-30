import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { YStack, Text } from 'tamagui';
import LottieView from 'lottie-react-native';
import { useThemeName } from 'tamagui';

interface ConnectionStatusOverlayProps {
  isVisible: boolean;
  statusMessage: string;
  progress?: number;
  error?: string;
  onDismiss?: () => void;
}

export function ConnectionStatusOverlay({
  isVisible,
  statusMessage,
  progress,
  error,
  onDismiss
}: ConnectionStatusOverlayProps) {
  const themeName = useThemeName();
  
  const loaderSource = themeName === 'dark'
    ? require('../assets/animations/SyncSonic_Loading_Dark_nbg.json')
    : require('../assets/animations/SyncSonic_Loading_Light_nbg.json');

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <YStack
          backgroundColor={themeName === 'dark' ? '#350066' : '#F9F5FF'}
          padding="$4"
          borderRadius="$4"
          width="80%"
          alignItems="center"
          space="$4"
        >
          <LottieView
            source={loaderSource}
            autoPlay
            loop
            style={styles.loader}
          />
          
          <Text
            fontFamily="Finlandica"
            fontSize={18}
            textAlign="center"
            color={themeName === 'dark' ? '#F2E8FF' : '#26004E'}
          >
            {statusMessage}
          </Text>

          {progress !== undefined && (
            <Text
              fontFamily="Finlandica"
              fontSize={14}
              color={themeName === 'dark' ? '#9D9D9D' : '#666'}
            >
              {progress}%
            </Text>
          )}

          {error && (
            <Text
              fontFamily="Finlandica"
              fontSize={14}
              color="#FF0055"
              textAlign="center"
            >
              {error}
            </Text>
          )}
        </YStack>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    width: 100,
    height: 100,
  }
}); 