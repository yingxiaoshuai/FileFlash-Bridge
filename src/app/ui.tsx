import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Button, IconButton, Surface } from 'react-native-paper';

import { theme } from './theme';

type ButtonTone = 'primary' | 'secondary' | 'danger';

type ActionButtonProps = {
  accessibilityLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  onPress: () => void;
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
    buttonColor: theme.colors.secondarySoft,
    mode: 'contained-tonal',
    textColor: theme.colors.ink,
  },
};

export function ActionButton({
  accessibilityLabel,
  compact,
  disabled,
  fullWidth,
  label,
  onPress,
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
  disabled?: boolean;
  glyph: string;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
};

export function GlyphIconButton({
  accessibilityLabel,
  disabled,
  glyph,
  onPress,
  selected,
  testID,
}: GlyphIconButtonProps) {
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      containerColor={
        selected ? theme.colors.primarySoft : theme.colors.surfaceGlassStrong
      }
      disabled={disabled}
      icon={({ size, color }) => (
        <Text
          style={[
            styles.iconGlyph,
            {
              color,
              fontSize: size * 0.88,
            },
          ]}
        >
          {glyph}
        </Text>
      )}
      iconColor={selected ? theme.colors.primaryStrong : theme.colors.ink}
      onPress={onPress}
      size={22}
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
      <View pointerEvents="none" style={styles.panelHighlight} />
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
    elevation: 3,
    shadowColor: theme.colors.shadowStrong,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  buttonContent: {
    minHeight: 44,
    paddingHorizontal: 8,
  },
  buttonContentCompact: {
    minHeight: 36,
  },
  buttonDanger: {
    borderColor: theme.colors.dangerSoft,
  },
  panel: {
    backgroundColor: theme.colors.surfaceGlassStrong,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    elevation: 10,
    position: 'relative',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      height: 20,
      width: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 32,
  },
  fullWidth: {
    width: '100%',
  },
  iconButton: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    margin: 0,
    shadowColor: theme.colors.shadowStrong,
    shadowOffset: {
      height: 7,
      width: 0,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  iconGlyph: {
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -1,
    textAlign: 'center',
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
  panelHighlight: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 999,
    height: 92,
    opacity: 0.4,
    position: 'absolute',
    right: 10,
    top: 8,
    width: 120,
  },
  banner: {
    alignItems: 'center',
    borderRadius: theme.radius.card,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  bannerInfo: {
    backgroundColor: theme.colors.secondarySoft,
  },
  bannerSuccess: {
    backgroundColor: theme.colors.successSoft,
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
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  emptyStateTitle: {
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  inlineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
