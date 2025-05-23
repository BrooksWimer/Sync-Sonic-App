import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { YStack, XStack, Text, View } from 'tamagui';
import LottieView from 'lottie-react-native';
import { useThemeName } from 'tamagui';
import { Check, X } from '@tamagui/lucide-icons';

interface ConnectionStatusOverlayProps {
  isVisible: boolean;
  statusMessage: string;
  progress?: number;
  error?: string;
  onDismiss?: () => void;
  mac?: string;
}

export function ConnectionStatusOverlay({
  isVisible,
  statusMessage,
  progress,
  error,
  onDismiss,
  mac
}: ConnectionStatusOverlayProps) {
  const themeName = useThemeName();
  
  const loaderSource = themeName === 'dark'
    ? require('../assets/animations/SyncSonic_Loading_Dark_nbg.json')
    : require('../assets/animations/SyncSonic_Loading_Light_nbg.json');

  const isDismissable = !!error || statusMessage.includes("successful");
  const bgColor = themeName === 'dark' ? '#350066' : '#F9F5FF';
  const textColor = themeName === 'dark' ? '#F2E8FF' : '#26004E';
  const accentColor = themeName === 'dark' ? '#E8004D' : '#3E0094';
  const successColor = themeName === 'dark' ? '#00FF6A' : '#34A853';
  const errorColor = '#FF0055';

  if (!isVisible) return null;

  return (
    <View 
      position="absolute" 
      top={0} 
      bottom={0} 
      left={0} 
      right={0} 
      zIndex={1000} 
      style={styles.overlay}
    >
      <YStack 
        space
        style={[styles.container, { backgroundColor: bgColor }]}
      >
        {!error && !statusMessage.includes("successful") ? (
          <LottieView
            source={loaderSource}
            autoPlay
            loop
            style={styles.loader}
          />
        ) : statusMessage.includes("successful") ? (
          <XStack style={[styles.iconContainer, { backgroundColor: successColor }]}>
            <Check size={40} color="white" />
          </XStack>
        ) : (
          <XStack style={[styles.iconContainer, { backgroundColor: errorColor }]}>
            <X size={40} color="white" />
          </XStack>
        )}
        
        <Text style={[styles.message, { color: textColor }]}>
          {statusMessage}
        </Text>

        {progress !== undefined && !error && !statusMessage.includes("successful") && (
          <>
            <View style={styles.progressContainer}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progress}%`, backgroundColor: accentColor }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress)}%
            </Text>
          </>
        )}

        {mac && (
          <Text style={styles.deviceText}>
            Device: {mac}
          </Text>
        )}

        {error && (
          <Text style={[styles.errorText, { color: errorColor }]}>
            {error}
          </Text>
        )}

        {isDismissable && (
          <TouchableOpacity 
            style={[
              styles.button, 
              { backgroundColor: error ? errorColor : successColor }
            ]} 
            onPress={onDismiss}
          >
            <Text style={styles.buttonText}>
              {error ? "Try Again" : "Done"}
            </Text>
          </TouchableOpacity>
        )}
      </YStack>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  loader: {
    width: 100,
    height: 100,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressContainer: {
    width: '90%',
    height: 8,
    backgroundColor: '#DDD',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  deviceText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    width: '60%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  }
}); 