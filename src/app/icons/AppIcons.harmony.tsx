import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type AppIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

function IconFrame({
  children,
  size = 20,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.frame,
        {
          height: size,
          width: size,
        },
      ]}
    >
      {children}
    </View>
  );
}

function Line({
  color,
  height,
  left,
  rotate,
  top,
  width,
}: {
  color: string;
  height: number;
  left: number;
  rotate?: string;
  top: number;
  width: number;
}) {
  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: color,
          height,
          left,
          top,
          transform: rotate ? [{ rotate }] : undefined,
          width,
        },
      ]}
    />
  );
}

export function HomeTabIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.85,
}: AppIconProps) {
  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.homeRoof,
          {
            borderColor: color,
            borderLeftWidth: strokeWidth,
            borderTopWidth: strokeWidth,
            height: size * 0.46,
            left: size * 0.27,
            top: size * 0.15,
            width: size * 0.46,
          },
        ]}
      />
      <View
        style={[
          styles.homeBody,
          {
            borderBottomWidth: strokeWidth,
            borderColor: color,
            borderLeftWidth: strokeWidth,
            borderRightWidth: strokeWidth,
            borderTopWidth: strokeWidth,
            height: size * 0.43,
            left: size * 0.22,
            top: size * 0.42,
            width: size * 0.56,
          },
        ]}
      />
      <View
        style={[
          styles.homeDoor,
          {
            borderColor: color,
            borderLeftWidth: strokeWidth,
            borderRightWidth: strokeWidth,
            borderTopWidth: strokeWidth,
            height: size * 0.25,
            left: size * 0.43,
            top: size * 0.61,
            width: size * 0.16,
          },
        ]}
      />
    </IconFrame>
  );
}

export function SettingsTabIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.75,
}: AppIconProps) {
  const spokeWidth = Math.max(strokeWidth, 1);

  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.settingsCenter,
          {
            borderColor: color,
            borderRadius: size * 0.18,
            borderWidth: strokeWidth,
            height: size * 0.36,
            left: size * 0.32,
            top: size * 0.32,
            width: size * 0.36,
          },
        ]}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.1}
        top={size * 0.48}
        width={size * 0.18}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.72}
        top={size * 0.48}
        width={size * 0.18}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.41}
        rotate="90deg"
        top={size * 0.16}
        width={size * 0.18}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.41}
        rotate="90deg"
        top={size * 0.78}
        width={size * 0.18}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.19}
        rotate="45deg"
        top={size * 0.25}
        width={size * 0.16}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.65}
        rotate="45deg"
        top={size * 0.71}
        width={size * 0.16}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.65}
        rotate="-45deg"
        top={size * 0.25}
        width={size * 0.16}
      />
      <Line
        color={color}
        height={spokeWidth}
        left={size * 0.19}
        rotate="-45deg"
        top={size * 0.71}
        width={size * 0.16}
      />
    </IconFrame>
  );
}

export function LanguageSettingsIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.7,
}: AppIconProps) {
  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.languageGlobe,
          {
            borderColor: color,
            borderRadius: size * 0.42,
            borderWidth: strokeWidth,
            height: size * 0.78,
            left: size * 0.11,
            top: size * 0.11,
            width: size * 0.78,
          },
        ]}
      />
      <Line
        color={color}
        height={strokeWidth}
        left={size * 0.13}
        top={size * 0.49}
        width={size * 0.74}
      />
      <View
        style={[
          styles.languageMeridian,
          {
            borderColor: color,
            borderLeftWidth: strokeWidth,
            borderRadius: size * 0.2,
            borderRightWidth: strokeWidth,
            height: size * 0.72,
            left: size * 0.34,
            top: size * 0.14,
            width: size * 0.32,
          },
        ]}
      />
    </IconFrame>
  );
}

export function WorkspaceConnectionsIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.8,
}: AppIconProps) {
  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.wifiArc,
          {
            borderColor: color,
            borderRadius: size * 0.44,
            borderTopWidth: strokeWidth,
            height: size * 0.58,
            left: size * 0.08,
            top: size * 0.25,
            width: size * 0.84,
          },
        ]}
      />
      <View
        style={[
          styles.wifiArc,
          {
            borderColor: color,
            borderRadius: size * 0.28,
            borderTopWidth: strokeWidth,
            height: size * 0.38,
            left: size * 0.25,
            top: size * 0.43,
            width: size * 0.5,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            borderRadius: size * 0.07,
            height: size * 0.14,
            left: size * 0.43,
            top: size * 0.7,
            width: size * 0.14,
          },
        ]}
      />
    </IconFrame>
  );
}

export function WorkspaceSharedIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.75,
}: AppIconProps) {
  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.folderBack,
          {
            borderColor: color,
            borderTopWidth: strokeWidth,
            height: size * 0.18,
            left: size * 0.15,
            top: size * 0.26,
            width: size * 0.36,
          },
        ]}
      />
      <View
        style={[
          styles.folderBody,
          {
            borderColor: color,
            borderRadius: size * 0.08,
            borderWidth: strokeWidth,
            height: size * 0.44,
            left: size * 0.14,
            top: size * 0.38,
            width: size * 0.72,
          },
        ]}
      />
      <Line
        color={color}
        height={strokeWidth}
        left={size * 0.47}
        rotate="-45deg"
        top={size * 0.58}
        width={size * 0.34}
      />
      <Line
        color={color}
        height={strokeWidth}
        left={size * 0.62}
        top={size * 0.5}
        width={size * 0.2}
      />
      <Line
        color={color}
        height={strokeWidth}
        left={size * 0.74}
        rotate="90deg"
        top={size * 0.58}
        width={size * 0.2}
      />
    </IconFrame>
  );
}

export function WorkspaceSecurityIcon({
  color = theme.colors.primaryStrong,
  secure = false,
  size = 18,
  strokeWidth = 1.75,
}: AppIconProps & {
  secure?: boolean;
}) {
  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.shield,
          {
            borderColor: color,
            borderRadius: size * 0.12,
            borderWidth: strokeWidth,
            height: size * 0.68,
            left: size * 0.22,
            top: size * 0.12,
            width: size * 0.56,
          },
        ]}
      />
      <View
        style={[
          styles.shieldPoint,
          {
            borderBottomWidth: strokeWidth,
            borderColor: color,
            borderRightWidth: strokeWidth,
            height: size * 0.28,
            left: size * 0.36,
            top: size * 0.56,
            width: size * 0.28,
          },
        ]}
      />
      {secure ? (
        <>
          <Line
            color={color}
            height={strokeWidth}
            left={size * 0.32}
            rotate="45deg"
            top={size * 0.52}
            width={size * 0.2}
          />
          <Line
            color={color}
            height={strokeWidth}
            left={size * 0.46}
            rotate="-45deg"
            top={size * 0.48}
            width={size * 0.28}
          />
        </>
      ) : (
        <>
          <Line
            color={color}
            height={strokeWidth}
            left={size * 0.46}
            rotate="90deg"
            top={size * 0.41}
            width={size * 0.22}
          />
          <Text
            style={[
              styles.securityDot,
              {
                color,
                fontSize: size * 0.22,
                left: size * 0.45,
                top: size * 0.57,
              },
            ]}
          >
            .
          </Text>
        </>
      )}
    </IconFrame>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
  folderBack: {
    borderTopLeftRadius: 3,
    position: 'absolute',
  },
  folderBody: {
    position: 'absolute',
  },
  frame: {
    position: 'relative',
  },
  homeBody: {
    borderRadius: 2,
    position: 'absolute',
  },
  homeDoor: {
    position: 'absolute',
  },
  homeRoof: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
  languageGlobe: {
    position: 'absolute',
  },
  languageMeridian: {
    position: 'absolute',
  },
  line: {
    borderRadius: 999,
    position: 'absolute',
  },
  securityDot: {
    fontWeight: '700',
    lineHeight: 4,
    position: 'absolute',
  },
  settingsCenter: {
    position: 'absolute',
  },
  shield: {
    position: 'absolute',
  },
  shieldPoint: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
  wifiArc: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderStyle: 'solid',
    borderBottomWidth: 0,
    position: 'absolute',
  },
});
