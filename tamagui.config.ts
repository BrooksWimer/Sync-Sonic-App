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
      size: {
        1: 12,
        2: 14,
        3: 16,
        4: 18,
        5: 20,
        6: 24,
        7: 28,
        8: 32,
        9: 36,
      },
      weight: {
        4: '400',
        7: '700',
      },
      lineHeight: {
        1: 17,
        2: 19,
        3: 21,
        4: 23,
        5: 25,
        6: 29,
        7: 33,
        8: 37,
        9: 41,
      },
    },
    heading: {
      family: 'Finlandica',
      size: {
        1: 12,
        2: 14,
        3: 16,
        4: 18,
        5: 20,
        6: 24,
        7: 28,
        8: 32,
        9: 36,
      },
      weight: {
        4: '400',
        7: '700',
      },
      lineHeight: {
        1: 17,
        2: 19,
        3: 21,
        4: 23,
        5: 25,
        6: 29,
        7: 33,
        8: 37,
        9: 41,
      },
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