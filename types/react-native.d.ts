declare module 'react-native' {
  export const Alert: {
    alert: (title: string, message?: string, buttons?: any[], options?: any) => void;
  };
  
  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
  };
  
  export const NativeModules: {
    [key: string]: any;
  };
} 