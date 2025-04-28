declare module 'react-native' {
  interface NativeModulesStatic {
    BluetoothManager: {
      getBondedDevices(): Promise<Array<{
        name: string;
        address: string;
        type: number;
      }>>;
      getConnectedDevices(): Promise<Array<{
        name: string;
        address: string;
        type: number;
      }>>;
    };
  }
} 