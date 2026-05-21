import { Easing } from 'react-native';

import { appColors } from './colors';

export const appTokens = {
  borderWidth: {
    hairline: 1,
    medium: 1,
    strong: 2,
  },
  duration: {
    fast: 150,
    medium: 220,
    slow: 320,
  },
  easing: {
    emphasized: Easing.bezier(0.2, 0, 0, 1),
    standard: Easing.bezier(0.4, 0, 0.2, 1),
  },
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    card: 22,
    panel: 28,
    pill: 999,
  },
  shadow: {
    action: {
      elevation: 4,
      shadowColor: appColors.shadowStrong,
      shadowOffset: {
        height: 8,
        width: 0,
      },
      shadowOpacity: 0.2,
      shadowRadius: 14,
    },
    card: {
      elevation: 8,
      shadowColor: appColors.shadow,
      shadowOffset: {
        height: 18,
        width: 0,
      },
      shadowOpacity: 0.2,
      shadowRadius: 28,
    },
    floating: {
      elevation: 16,
      shadowColor: appColors.shadowStrong,
      shadowOffset: {
        height: 20,
        width: 0,
      },
      shadowOpacity: 0.24,
      shadowRadius: 30,
    },
    subtle: {
      elevation: 2,
      shadowColor: appColors.shadow,
      shadowOffset: {
        height: 6,
        width: 0,
      },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
} as const;

export type AppTokens = typeof appTokens;
