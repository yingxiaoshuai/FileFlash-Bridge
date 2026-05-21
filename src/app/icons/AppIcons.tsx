import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { theme } from '../theme';

export type AppIconProps = {
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

function IconBase({
  children,
  size = theme.tokens.iconSize.md,
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

export function AppIcon({
  color = theme.colors.primaryStrong,
  name,
  size = theme.tokens.iconSize.md,
  strokeWidth = 1.85,
}: AppIconProps & {
  name: AppIconName;
}) {
  switch (name) {
    case 'add':
      return <AddIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'check':
      return <CheckIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'close':
      return <CloseIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'connections':
      return (
        <WorkspaceConnectionsIcon
          color={color}
          size={size}
          strokeWidth={strokeWidth}
        />
      );
    case 'copy':
      return <CopyIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'delete':
      return <DeleteIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'download':
      return (
        <DownloadIcon color={color} size={size} strokeWidth={strokeWidth} />
      );
    case 'file':
      return <FileIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'help':
      return <HelpIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'home':
      return <HomeTabIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'image':
      return <ImageIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'info':
      return <InfoIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'language':
      return (
        <LanguageSettingsIcon
          color={color}
          size={size}
          strokeWidth={strokeWidth}
        />
      );
    case 'menu':
      return <MenuIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'more':
      return <MoreIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'refresh':
      return (
        <RefreshIcon color={color} size={size} strokeWidth={strokeWidth} />
      );
    case 'remove':
      return <RemoveIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'security-secure':
      return (
        <WorkspaceSecurityIcon
          color={color}
          secure
          size={size}
          strokeWidth={strokeWidth}
        />
      );
    case 'security-simple':
      return (
        <WorkspaceSecurityIcon
          color={color}
          size={size}
          strokeWidth={strokeWidth}
        />
      );
    case 'settings':
      return (
        <SettingsTabIcon color={color} size={size} strokeWidth={strokeWidth} />
      );
    case 'share':
      return <ShareIcon color={color} size={size} strokeWidth={strokeWidth} />;
    case 'shared':
      return (
        <WorkspaceSharedIcon
          color={color}
          size={size}
          strokeWidth={strokeWidth}
        />
      );
    default:
      return <InfoIcon color={color} size={size} strokeWidth={strokeWidth} />;
  }
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

function AddIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function CheckIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="m5 12.6 4.2 4.1L19 7"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function CloseIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M7 7l10 10M17 7 7 17"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function CopyIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Rect
        height="10.8"
        rx="2"
        stroke={color}
        strokeWidth={strokeWidth}
        width="10.8"
        x="8"
        y="7.2"
      />
      <Path
        d="M6.2 15.2H5.7A2.2 2.2 0 0 1 3.5 13V5.8a2.2 2.2 0 0 1 2.2-2.2h7.2a2.2 2.2 0 0 1 2.2 2.2v.5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function DeleteIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M5 7h14M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7M8 10v7.2A2.8 2.8 0 0 0 10.8 20h2.4A2.8 2.8 0 0 0 16 17.2V10M10.4 11.2v5.2M13.6 11.2v5.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function DownloadIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M12 4v10M8.2 10.4 12 14.2l3.8-3.8M5 18.8h14"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function FileIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M7 4h6l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M13 4v4h4M8 12h8M8 15.5h5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function HelpIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.9 9.6a2.25 2.25 0 1 1 3.15 2.05c-.72.38-1.05.88-1.05 1.75M12 16.7h.01"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function ImageIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Rect
        height="14"
        rx="2.2"
        stroke={color}
        strokeWidth={strokeWidth}
        width="16"
        x="4"
        y="5"
      />
      <Circle cx="9" cy="10" fill={color} r="1.2" />
      <Path
        d="m6.5 17 4.1-4.1 2.6 2.6 1.7-1.7L18 17"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function InfoIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 10.8v5.2M12 7.8h.01"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function MenuIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M5 7h14M5 12h14M5 17h14"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function MoreIcon({ color, size }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Circle cx="6.8" cy="12" fill={color} r="1.35" />
      <Circle cx="12" cy="12" fill={color} r="1.35" />
      <Circle cx="17.2" cy="12" fill={color} r="1.35" />
    </IconBase>
  );
}

function RefreshIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M18.6 8.2A7.2 7.2 0 0 0 6.2 7.3L5 8.8M5.4 15.8a7.2 7.2 0 0 0 12.4.9l1.2-1.5M5 5.3v3.5h3.5M19 18.7v-3.5h-3.5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function RemoveIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M5 12h14"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}

function ShareIcon({ color, size, strokeWidth }: Required<AppIconProps>) {
  return (
    <IconBase size={size}>
      <Path
        d="M12 15V5M8.4 8.6 12 5l3.6 3.6M6 12.6v4.7A1.7 1.7 0 0 0 7.7 19h8.6a1.7 1.7 0 0 0 1.7-1.7v-4.7"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </IconBase>
  );
}
