import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AccessibilityState, StyleProp, ViewStyle } from 'react-native';
import { Button, IconButton, Surface } from 'react-native-paper';

import { AppIcon } from './icons/AppIcons';
import type { AppIconName } from './icons/AppIcons';
import { theme } from './theme';

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'warning';

type ActionButtonProps = {
  accessibilityLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone?: ButtonTone;
};

const toneConfig: Record<
  ButtonTone,
  {
    buttonColor?: string;
    mode: 'contained' | 'contained-tonal' | 'outlined';
    textColor: string;
  }
> = {
  danger: {
    mode: 'outlined',
    textColor: theme.colors.dangerStrong,
  },
  primary: {
    buttonColor: theme.colors.primary,
    mode: 'contained',
    textColor: theme.colors.inkOnStrong,
  },
  secondary: {
    buttonColor: theme.colors.surfaceMuted,
    mode: 'contained-tonal',
    textColor: theme.colors.primary,
  },
  warning: {
    buttonColor: theme.colors.danger,
    mode: 'contained',
    textColor: theme.colors.inkOnStrong,
  },
};

export function ActionButton({
  accessibilityLabel,
  compact,
  disabled,
  fullWidth,
  label,
  onPress,
  style,
  testID,
  tone = 'secondary',
}: ActionButtonProps) {
  const config = toneConfig[tone];

  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      buttonColor={config.buttonColor}
      compact={compact}
      contentStyle={[
        styles.buttonContent,
        compact ? styles.buttonContentCompact : null,
      ]}
      disabled={disabled}
      mode={config.mode}
      onPress={onPress}
      style={[
        styles.button,
        tone === 'danger' ? styles.buttonDanger : null,
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
      testID={testID}
      textColor={config.textColor}
    >
      {label}
    </Button>
  );
}

type GlyphIconButtonProps = {
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  iconName: AppIconName;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
};

export function GlyphIconButton({
  accessibilityLabel,
  accessibilityState,
  disabled,
  iconName,
  onPress,
  selected,
  testID,
}: GlyphIconButtonProps) {
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      accessibilityState={
        accessibilityState ?? (disabled ? { disabled: true } : undefined)
      }
      containerColor={
        selected ? theme.colors.primarySoft : theme.colors.iconSurface
      }
      disabled={disabled}
      icon={({ size, color }) => (
        <AppIcon
          color={color}
          name={iconName}
          size={Math.min(size, theme.tokens.iconSize.lg)}
          strokeWidth={selected ? 2.15 : 1.85}
        />
      )}
      iconColor={selected ? theme.colors.primaryStrong : theme.colors.primary}
      onPress={onPress}
      size={theme.tokens.iconSize.md}
      style={styles.iconButton}
      testID={testID}
    />
  );
}

type PanelSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PanelSurface({ children, style, testID }: PanelSurfaceProps) {
  return (
    <Surface mode="flat" style={[styles.panel, style]} testID={testID}>
      <View pointerEvents="none" style={styles.panelSheen} />
      {children}
    </Surface>
  );
}

type FeedbackBannerProps = {
  message: string;
  onDismiss: () => void;
  tone: 'info' | 'success' | 'error';
};

export function FeedbackBanner({
  message,
  onDismiss,
  tone,
}: FeedbackBannerProps) {
  return (
    <Surface
      mode="flat"
      style={[
        styles.banner,
        tone === 'success'
          ? styles.bannerSuccess
          : tone === 'error'
          ? styles.bannerError
          : styles.bannerInfo,
      ]}
    >
      <Text style={styles.bannerMessage}>{message}</Text>
      <ActionButton compact label="关闭" onPress={onDismiss} />
    </Surface>
  );
}

type EmptyStateCardProps = {
  title: string;
};

export function EmptyStateCard({ title }: EmptyStateCardProps) {
  return (
    <Surface mode="flat" style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
    </Surface>
  );
}

type InlineMetaProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function InlineMeta({ children, style }: InlineMetaProps) {
  return <View style={[styles.inlineMeta, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.pill,
    ...theme.tokens.shadow.action,
  },
  buttonContent: {
    minHeight: 44,
    paddingHorizontal: theme.tokens.spacing.sm,
  },
  buttonContentCompact: {
    minHeight: 36,
  },
  buttonDanger: {
    backgroundColor: theme.colors.dangerSoft,
    borderColor: theme.colors.danger,
  },
  panel: {
    backgroundColor: theme.colors.panelWarm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    position: 'relative',
    ...theme.tokens.shadow.card,
  },
  fullWidth: {
    width: '100%',
  },
  iconButton: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    height: 44,
    margin: 0,
    width: 44,
    ...theme.tokens.shadow.subtle,
  },
  panelSheen: {
    backgroundColor: theme.colors.highlight,
    height: 1,
    left: 1,
    opacity: 0.85,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  banner: {
    alignItems: 'center',
    borderRadius: theme.radius.card,
    flexDirection: 'row',
    gap: theme.tokens.spacing.md - 2,
    justifyContent: 'space-between',
    paddingHorizontal: theme.tokens.spacing.md + 2,
    paddingVertical: theme.tokens.spacing.md,
  },
  bannerInfo: {
    backgroundColor: theme.colors.skySoft,
  },
  bannerSuccess: {
    backgroundColor: theme.colors.mintSoft,
  },
  bannerError: {
    backgroundColor: theme.colors.dangerSoft,
  },
  bannerMessage: {
    color: theme.colors.ink,
    flex: 1,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: theme.colors.emptySurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    paddingHorizontal: theme.tokens.spacing.md + 2,
    paddingVertical: theme.tokens.spacing.lg,
  },
  emptyStateTitle: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  inlineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.tokens.spacing.sm + 2,
  },
});
