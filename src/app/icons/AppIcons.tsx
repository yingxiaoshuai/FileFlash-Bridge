import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '../theme';

type AppIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

function IconBase({
  children,
  size = 20,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </Svg>
  );
}

export function HomeTabIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.85,
}: AppIconProps) {
  return (
    <IconBase size={size}>
      <Path
        d="M4.75 10.8 12 5l7.25 5.8V18a1.5 1.5 0 0 1-1.5 1.5H14v-4.8h-4v4.8H6.25A1.5 1.5 0 0 1 4.75 18z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

export function SettingsTabIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.75,
}: AppIconProps) {
  return (
    <IconBase size={size}>
      <Path
        d="M12 4v2.1M12 17.9V20M6.35 6.35l1.48 1.48M16.17 16.17l1.48 1.48M4 12h2.1M17.9 12H20M6.35 17.65l1.48-1.48M16.17 7.83l1.48-1.48"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx="12"
        cy="12"
        r="4.05"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

export function LanguageSettingsIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.7,
}: AppIconProps) {
  return (
    <IconBase size={size}>
      <Circle
        cx="12"
        cy="12"
        r="8.15"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M3.85 12h16.3M12 3.85c2.25 2.3 3.45 5.25 3.45 8.15 0 2.9-1.2 5.85-3.45 8.15M12 3.85c-2.25 2.3-3.45 5.25-3.45 8.15 0 2.9 1.2 5.85 3.45 8.15"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

export function WorkspaceConnectionsIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.8,
}: AppIconProps) {
  return (
    <IconBase size={size}>
      <Path
        d="M5.6 10a9 9 0 0 1 12.8 0"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M8.6 13a4.8 4.8 0 0 1 6.8 0"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle cx="12" cy="16.4" fill={color} r="1.4" />
    </IconBase>
  );
}

export function WorkspaceSharedIcon({
  color = theme.colors.primaryStrong,
  size = 18,
  strokeWidth = 1.75,
}: AppIconProps) {
  return (
    <IconBase size={size}>
      <Path
        d="M3.85 9.2h16.3v7.25a2 2 0 0 1-2 2H5.85a2 2 0 0 1-2-2z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M3.85 9.2 6.8 6.6h4.35l1.85 1.75h7.15"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M13.3 10.9h4.2v4.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M17.5 10.9 11.25 17.15"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
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
    <IconBase size={size}>
      <Path
        d="M12 4.15 18.1 6.4v4.5c0 3.8-2.45 6.55-6.1 8-3.65-1.45-6.1-4.2-6.1-8V6.4z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      {secure ? (
        <Path
          d="m9.2 11.8 1.8 1.85 3.9-4.2"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      ) : (
        <>
          <Path
            d="M12 8.95v3.05"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle cx="12" cy="14.4" fill={color} r="0.85" />
        </>
      )}
    </IconBase>
  );
}
