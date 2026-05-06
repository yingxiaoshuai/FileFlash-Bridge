import React from 'react';
import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
} from 'react-native';

import { theme } from '../theme';

type AppIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type IconAssetName =
  | 'connections'
  | 'home'
  | 'language'
  | 'security-secure'
  | 'security-simple'
  | 'settings'
  | 'shared';

const iconAssets: Record<IconAssetName, ImageSourcePropType> = {
  connections: require('../../assets/icons/connections.png'),
  home: require('../../assets/icons/home.png'),
  language: require('../../assets/icons/language.png'),
  'security-secure': require('../../assets/icons/security-secure.png'),
  'security-simple': require('../../assets/icons/security-simple.png'),
  settings: require('../../assets/icons/settings.png'),
  shared: require('../../assets/icons/shared.png'),
};

function MaskIcon({
  color = theme.colors.primaryStrong,
  name,
  size = 18,
  style,
}: {
  color?: string;
  name: IconAssetName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      resizeMode="contain"
      source={iconAssets[name]}
      style={[
        styles.icon,
        {
          height: size,
          tintColor: color,
          width: size,
        },
        style,
      ]}
    />
  );
}

export function HomeTabIcon({
  color = theme.colors.primaryStrong,
  size = 18,
}: AppIconProps) {
  return <MaskIcon color={color} name="home" size={size} />;
}

export function SettingsTabIcon({
  color = theme.colors.primaryStrong,
  size = 18,
}: AppIconProps) {
  return <MaskIcon color={color} name="settings" size={size} />;
}

export function LanguageSettingsIcon({
  color = theme.colors.primaryStrong,
  size = 18,
}: AppIconProps) {
  return <MaskIcon color={color} name="language" size={size} />;
}

export function WorkspaceConnectionsIcon({
  color = theme.colors.primaryStrong,
  size = 18,
}: AppIconProps) {
  return <MaskIcon color={color} name="connections" size={size} />;
}

export function WorkspaceSharedIcon({
  color = theme.colors.primaryStrong,
  size = 18,
}: AppIconProps) {
  return <MaskIcon color={color} name="shared" size={size} />;
}

export function WorkspaceSecurityIcon({
  color = theme.colors.primaryStrong,
  secure = false,
  size = 18,
}: AppIconProps & {
  secure?: boolean;
}) {
  return (
    <MaskIcon
      color={color}
      name={secure ? 'security-secure' : 'security-simple'}
      size={size}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
  },
});
