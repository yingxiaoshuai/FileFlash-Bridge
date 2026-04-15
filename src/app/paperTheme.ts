import {MD3LightTheme} from 'react-native-paper';

import {theme} from './theme';

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 7,
  colors: {
    ...MD3LightTheme.colors,
    background: theme.colors.background,
    error: theme.colors.danger,
    errorContainer: theme.colors.dangerSoft,
    onBackground: theme.colors.ink,
    onError: theme.colors.inkOnStrong,
    onPrimary: theme.colors.inkOnStrong,
    onPrimaryContainer: theme.colors.primaryStrong,
    onSecondaryContainer: theme.colors.ink,
    onSurface: theme.colors.ink,
    onSurfaceVariant: theme.colors.inkSoft,
    outline: theme.colors.border,
    outlineVariant: theme.colors.borderStrong,
    primary: theme.colors.primary,
    primaryContainer: theme.colors.primarySoft,
    secondary: theme.colors.secondary,
    secondaryContainer: theme.colors.secondarySoft,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceMuted,
    tertiary: theme.colors.success,
    tertiaryContainer: theme.colors.successSoft,
  },
};

export type AppPaperTheme = typeof paperTheme;
