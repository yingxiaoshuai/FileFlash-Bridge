import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AccessibilityState, StyleProp, ViewStyle } from 'react-native';
import { Button, Surface } from 'react-native-paper';

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
  const iconColor = selected
    ? theme.colors.primaryStrong
    : theme.colors.primary;
  const resolvedAccessibilityState =
    accessibilityState || disabled || selected
      ? {
          ...accessibilityState,
          disabled: disabled || accessibilityState?.disabled,
          selected: selected || accessibilityState?.selected,
        }
      : undefined;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={resolvedAccessibilityState}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        selected ? styles.iconButtonSelected : null,
        pressed && !disabled ? styles.iconButtonPressed : null,
        disabled ? styles.iconButtonDisabled : null,
      ]}
      testID={testID}
    >
      <View pointerEvents="none" style={styles.iconButtonContent}>
        <AppIcon
          color={iconColor}
          name={iconName}
          size={theme.tokens.iconSize.md}
          strokeWidth={selected ? 2.15 : 1.85}
        />
      </View>
    </Pressable>
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
  closeLabel?: string;
  message: string;
  onDismiss: () => void;
  tone: 'info' | 'success' | 'error';
};

export function FeedbackBanner({
  closeLabel = '关闭',
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
      testID="feedback-banner"
    >
      <Text numberOfLines={2} style={styles.bannerMessage}>
        {message}
      </Text>
      <Pressable
        accessibilityLabel={closeLabel}
        accessibilityRole="button"
        onPress={onDismiss}
        testID="feedback-banner-close"
        style={({ pressed }) => [
          styles.bannerClose,
          pressed ? styles.bannerClosePressed : null,
        ]}
      >
        <Text style={styles.bannerCloseLabel}>{closeLabel}</Text>
      </Pressable>
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
    alignItems: 'center',
    backgroundColor: theme.colors.iconSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    margin: 0,
    width: 44,
    ...theme.tokens.shadow.subtle,
  },
  iconButtonContent: {
    alignItems: 'center',
    height: theme.tokens.iconSize.md,
    justifyContent: 'center',
    width: theme.tokens.iconSize.md,
  },
  iconButtonDisabled: {
    opacity: 0.42,
  },
  iconButtonPressed: {
    backgroundColor: theme.colors.primarySoft,
    transform: [{ scale: 0.96 }],
  },
  iconButtonSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
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
    alignSelf: 'center',
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    maxWidth: 520,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: '100%',
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
    minWidth: 0,
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  bannerClose: {
    borderRadius: theme.radius.pill,
    flexShrink: 0,
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bannerClosePressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  bannerCloseLabel: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
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
