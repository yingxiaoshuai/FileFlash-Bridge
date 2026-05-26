import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

import { theme } from '../theme';

type AppIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export type AppIconName =
  | 'add'
  | 'check'
  | 'close'
  | 'connections'
  | 'copy'
  | 'delete'
  | 'download'
  | 'file'
  | 'help'
  | 'home'
  | 'image'
  | 'info'
  | 'language'
  | 'menu'
  | 'more'
  | 'refresh'
  | 'remove'
  | 'security-secure'
  | 'security-simple'
  | 'settings'
  | 'share'
  | 'shared';

const iconAssets: Record<AppIconName, ImageSourcePropType> = {
  add: require('../../assets/icons/add.png'),
  check: require('../../assets/icons/check.png'),
  close: require('../../assets/icons/close.png'),
  connections: require('../../assets/icons/connections.png'),
  copy: require('../../assets/icons/copy.png'),
  delete: require('../../assets/icons/delete.png'),
  download: require('../../assets/icons/download.png'),
  file: require('../../assets/icons/file.png'),
  help: require('../../assets/icons/help.png'),
  home: require('../../assets/icons/home.png'),
  image: require('../../assets/icons/image.png'),
  info: require('../../assets/icons/info.png'),
  language: require('../../assets/icons/language.png'),
  menu: require('../../assets/icons/menu.png'),
  more: require('../../assets/icons/more.png'),
  refresh: require('../../assets/icons/refresh.png'),
  remove: require('../../assets/icons/remove.png'),
  'security-secure': require('../../assets/icons/security-secure.png'),
  'security-simple': require('../../assets/icons/security-simple.png'),
  settings: require('../../assets/icons/settings.png'),
  share: require('../../assets/icons/share.png'),
  shared: require('../../assets/icons/shared.png'),
};

function MaskIcon({
  color = theme.colors.primaryStrong,
  name,
  size = theme.tokens.iconSize.md,
  style,
}: {
  color?: string;
  name: AppIconName;
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

export function AppIcon({
  color = theme.colors.primaryStrong,
  name,
  size = theme.tokens.iconSize.md,
}: AppIconProps & {
  name: AppIconName;
}) {
  return <MaskIcon color={color} name={name} size={size} />;
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
