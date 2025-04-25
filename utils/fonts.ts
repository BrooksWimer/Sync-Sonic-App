import { useFonts } from 'expo-font';
import { useEffect } from 'react';

export function useCustomFonts() {
  const [fontsLoaded, error] = useFonts({
    'Finlandica': require('../assets/fonts/Finlandica-VariableFont_wght.ttf'),
    'Finlandica-Italic': require('../assets/fonts/Finlandica-Italic-VariableFont_wght.ttf'),
  });

  useEffect(()=> {
    if (fontsLoaded) {
      console.log('fonts loaded', fontsLoaded);
    }
  },[])

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