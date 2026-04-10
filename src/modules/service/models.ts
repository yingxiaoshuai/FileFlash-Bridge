export type SecurityMode = 'simple' | 'secure';
export type NetworkMode = 'wifi' | 'hotspot' | 'offline' | 'unknown';
export type ServicePhase = 'idle' | 'starting' | 'running' | 'stopped' | 'error';
export type CompressionMode = 'gzip' | 'none';

export type ServiceErrorCode =
  | 'NETWORK_REFRESHED'
  | 'NETWORK_UNAVAILABLE'
  | 'PORT_IN_USE'
  | 'SERVICE_STOPPED'
  | 'SESSION_LIMIT_REACHED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_WRITE_FAILED'
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'TEXT_TOO_LARGE';

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
  recoverable: boolean;
  suggestedAction?: string;
}

export interface ServiceConfig {
  port: number;
  chunkSize: number;
  largeFileThreshold: number;
  compressionThreshold: number;
  securityMode: SecurityMode;
  accessKey: string;
  maxActiveConnections: number;
  deviceName: string;
  maxTextLength: number;
  sessionId: string;
}

export interface NetworkSnapshot {
  mode: NetworkMode;
  label: string;
  reachable: boolean;
  address?: string;
  interfaceName?: string;
}

export interface ActiveConnection {
  id: string;
  label: string;
  lastSeenAt: string;
}

export interface ServiceState {
  phase: ServicePhase;
  config: ServiceConfig;
  network: NetworkSnapshot;
  accessUrl?: string;
  qrValue?: string;
  error?: ServiceError;
  activeConnections: ActiveConnection[];
  sharedFileCount: number;
  activeProjectId?: string;
}

export interface TextMessage {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  source: 'browser' | 'app';
}

export interface ProjectRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  fileIds: string[];
  messages: TextMessage[];
}

export interface SharedFileRecord {
  id: string;
  projectId: string;
  displayName: string;
  relativePath: string;
  storagePath: string;
  compression: CompressionMode;
  createdAt: string;
  mimeType?: string;
  originalSize: number;
  size: number;
  storedSize: number;
  isLargeFile: boolean;
}

export interface StorageSnapshot {
  sessionId: string;
  activeProjectId: string;
  sharedFileIds: string[];
  projects: ProjectRecord[];
  files: Record<string, SharedFileRecord>;
}

export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  port: 8668,
  chunkSize: 1024 * 1024,
  largeFileThreshold: 8 * 1024 * 1024,
  compressionThreshold: 2 * 1024 * 1024,
  securityMode: 'secure',
  accessKey: 'replace-me',
  maxActiveConnections: 3,
  deviceName: 'FileFlash Bridge',
  maxTextLength: 200_000,
  sessionId: 'default-session',
};

export const EMPTY_NETWORK_SNAPSHOT: NetworkSnapshot = {
  mode: 'offline',
  label: '无可用局域网',
  reachable: false,
};

export function createInitialServiceState(config: ServiceConfig): ServiceState {
  return {
    phase: 'idle',
    config,
    network: EMPTY_NETWORK_SNAPSHOT,
    activeConnections: [],
    sharedFileCount: 0,
  };
}

export function createId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  const fallback = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now().toString(16)}-${fallback}`;
}
