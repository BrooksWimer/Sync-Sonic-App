import { useFonts } from 'expo-font';
import { useEffect } from 'react';

export function useCustomFonts() {
  const [fontsLoaded, error] = useFonts({
    'Finlandica': require('../assets/fonts/Finlandica-VariableFont_wght.ttf'),
    'Finlandica-Regular': require('../assets/fonts/Finlandica-Regular.ttf'),
    'Finlandica-Medium': require('../assets/fonts/Finlandica-Medium.ttf'),
    'Finlandica-SemiBold': require('../assets/fonts/Finlandica-SemiBold.ttf'),
    'Finlandica-Bold': require('../assets/fonts/Finlandica-Bold.ttf'),
    'Finlandica-Italic': require('../assets/fonts/Finlandica-Italic.ttf'),
    'Finlandica-SemiBoldItalic': require('../assets/fonts/Finlandica-SemiBoldItalic.ttf'),
    'Finlandica-BoldItalic': require('../assets/fonts/Finlandica-BoldItalic.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.otf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.otf'),
  });

  useEffect(() => {
    if (error) {
      console.error('Error loading fonts:', error);
    }
  }, [error]);

  return fontsLoaded;
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const fontsLoaded = useCustomFonts();

  if (!fontsLoaded) {
    return null;
  }

  return children;
} 