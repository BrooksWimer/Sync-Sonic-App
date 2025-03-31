import { createTamagui, getConfig } from '@tamagui/core'
import colors from './assets/colors/colors';


export const config = createTamagui({
  tokens: {
    size: {
      // Add more if needed
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      7: 48
    },
    space: {
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      7: 48
    },
    radius: {
      none: 0,
      sm: 3,
      md: 6,
      lg: 12,
    },
    color: {
      white: '#fff',
      black: '#000',
    },
  },
  


  themes: {
    light: {
      bg: colors.backgroundLight,
      textColor: colors.textLight,
      popColor: colors.syncPurple,
      borderColor: colors.subtextLight,
      shadowColor: 'rgba(0,0,0,0.1)',
    },
    dark: {
      bg: colors.backgroundDark,
      textColor: colors.textDark,
      popColor: colors.syncPink,
      borderColor: colors.subtextDark,
      shadowColor: 'rgba(0,0,0,0.3)',
    },
  },

  font: {
    body: {
      family: 'Finlandica',
      size: 16,
      weight: '400',
      lineHeight: 24,
    },
    heading: {
      family: 'Finlandica',
      size: 24,
      weight: '700',
      lineHeight: 32,
    },
  },
  
  

  // media query definitions can be used to style,
  // but also can be used with "groups" to do container queries by size:
  media: {
    sm: { maxWidth: 860 },
    gtSm: { minWidth: 860 + 1 },
    short: { maxHeight: 820 },
    hoverNone: { hover: 'none' },
    pointerCoarse: { pointer: 'coarse' },
  },

  shorthands: {
    // <View px={20} />
    px: 'paddingHorizontal',
  },

  settings: {
    disableSSR: true, // for client-side apps gains a bit of performance
    allowedStyleValues: 'somewhat-strict-web', // if targeting only web
  },
})

// in other files use this:
console.log(`config is`, getConfig())

// get typescript types on @tamagui/core imports:
type AppConfig = typeof config

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}