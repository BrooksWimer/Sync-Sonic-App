import { ExpoConfig, ConfigContext } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Sync-Sonic',
  slug: 'sync-sonic',
  owner: 'sync-sonic',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    ...config.ios,
    supportsTablet: true,
    bundleIdentifier: 'com.sync-sonic.sync-sonic',
    userInterfaceStyle: 'automatic',

    // ← Add these two keys for BLE on iOS
    newArchEnabled: false,
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSBluetoothAlwaysUsageDescription: 'Sync-Sonic needs Bluetooth to connect to speakers',
      NSBluetoothPeripheralUsageDescription:
        'Sync-Sonic needs Bluetooth to connect to speakers',
        ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
    package: 'com.syncsonic.SyncSonic',
    userInterfaceStyle: 'automatic',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#F2E8FF',
      },
    ],

    // ← BLE module (already present)  
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: true,
        modes: ['peripheral', 'central'],
        bluetoothAlwaysPermission:
          'Allow $(PRODUCT_NAME) to connect to bluetooth devices',
      },
    ],

    // ← Add this to enable the permissions plugin
    [
      'react-native-permissions',
      {
        iosPermissions: [
          'NSBluetoothAlwaysUsageDescription',
          'NSBluetoothPeripheralUsageDescription',
        ],
        androidPermissions: [
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.ACCESS_COARSE_LOCATION',
        ],
      },
    ],
    

    'expo-sqlite',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: 'a3f49fa9-2789-40b4-9826-bf1dcfe0049e',
    },
  },
});
