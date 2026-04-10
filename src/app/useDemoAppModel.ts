import {useMemo, useState} from 'react';

import {
  buildAccessUrl,
  describeSecurityMode,
  generateAccessKey,
} from '../modules/security/accessControl';
import {resolveNetworkSnapshot} from '../modules/service/networkResolver';
import {
  DEFAULT_SERVICE_CONFIG,
  ProjectRecord,
  ServiceState,
  SharedFileRecord,
  TextMessage,
  createId,
  createInitialServiceState,
} from '../modules/service/models';

const SAMPLE_MESSAGES: TextMessage[] = [
  {
    id: createId('msg'),
    projectId: 'project-current',
    content: '浏览器刚刚投递了一段要发给手机端的会议纪要。',
    createdAt: '2026-04-10T09:15:00.000Z',
    source: 'browser',
  },
  {
    id: createId('msg'),
    projectId: 'project-current',
    content: '第二次文本提交会继续追加到当前活跃项目里。',
    createdAt: '2026-04-10T09:18:00.000Z',
    source: 'browser',
  },
];

const SAMPLE_PROJECTS: ProjectRecord[] = [
  {
    id: 'project-current',
    title: '当前分享轮次',
    createdAt: '2026-04-10T09:00:00.000Z',
    updatedAt: '2026-04-10T09:18:00.000Z',
    fileIds: ['file-1', 'file-2'],
    messages: SAMPLE_MESSAGES,
  },
  {
    id: 'project-archive',
    title: '历史项目',
    createdAt: '2026-04-08T14:12:00.000Z',
    updatedAt: '2026-04-08T14:33:00.000Z',
    fileIds: [],
    messages: [
      {
        id: createId('msg'),
        projectId: 'project-archive',
        content: '之前的文本接收记录会继续保留，直到用户主动删除。',
        createdAt: '2026-04-08T14:33:00.000Z',
        source: 'browser',
      },
    ],
  },
];

const SAMPLE_SHARED_FILES: SharedFileRecord[] = [
  {
    id: 'file-1',
    projectId: 'project-current',
    displayName: 'handoff-note.md',
    relativePath: 'handoff-note.md',
    storagePath: 'sessions/project-current/handoff-note.md.gz',
    compression: 'gzip',
    createdAt: '2026-04-10T09:12:00.000Z',
    mimeType: 'text/markdown',
    originalSize: 31_842,
    size: 31_842,
    storedSize: 12_008,
    isLargeFile: false,
  },
  {
    id: 'file-2',
    projectId: 'project-current',
    displayName: 'demo-recording.mov',
    relativePath: 'captures/demo-recording.mov',
    storagePath: 'sessions/project-current/demo-recording.mov',
    compression: 'none',
    createdAt: '2026-04-10T09:13:00.000Z',
    mimeType: 'video/quicktime',
    originalSize: 25_165_824,
    size: 25_165_824,
    storedSize: 25_165_824,
    isLargeFile: true,
  },
];

const NETWORK_SNAPSHOT = resolveNetworkSnapshot([
  {
    address: '192.168.31.84',
    family: 'IPv4',
    internal: false,
    modeHint: 'wifi',
    name: 'Wi-Fi',
  },
]);

function buildRunningState(
  currentState: ServiceState,
  overrides?: Partial<ServiceState>,
): ServiceState {
  const baseUrl = `http://${NETWORK_SNAPSHOT.address}:${currentState.config.port}`;
  const accessUrl = buildAccessUrl(
    baseUrl,
    currentState.config.securityMode,
    currentState.config.accessKey,
  );

  return {
    ...currentState,
    ...overrides,
    phase: 'running',
    network: NETWORK_SNAPSHOT,
    accessUrl,
    qrValue: accessUrl,
  };
}

export function useDemoAppModel() {
  const [projects] = useState<ProjectRecord[]>(SAMPLE_PROJECTS);
  const [sharedFiles] = useState<SharedFileRecord[]>(SAMPLE_SHARED_FILES);
  const [serviceState, setServiceState] = useState<ServiceState>(() =>
    buildRunningState(
      {
        ...createInitialServiceState(DEFAULT_SERVICE_CONFIG),
        activeProjectId: 'project-current',
        sharedFileCount: SAMPLE_SHARED_FILES.length,
        config: {
          ...DEFAULT_SERVICE_CONFIG,
          accessKey: generateAccessKey(),
        },
      },
      {
        activeConnections: [
          {
            id: createId('conn'),
            label: 'macOS Safari',
            lastSeenAt: '2026-04-10T09:18:20.000Z',
          },
        ],
      },
    ),
  );

  const securityCopy = useMemo(
    () => describeSecurityMode(serviceState.config.securityMode),
    [serviceState.config.securityMode],
  );

  const toggleService = () => {
    setServiceState(currentState => {
      if (currentState.phase === 'running') {
        return {
          ...currentState,
          phase: 'stopped',
          accessUrl: undefined,
          qrValue: undefined,
          activeConnections: [],
        };
      }

      return buildRunningState(currentState);
    });
  };

  const refreshAddress = () => {
    setServiceState(currentState =>
      buildRunningState(currentState, {
        error: {
          code: 'NETWORK_REFRESHED',
          message: '已重新探测当前网络地址，并同步更新链接与二维码。',
          recoverable: true,
          suggestedAction: '继续使用新的地址访问',
        },
      }),
    );
  };

  const rotateKey = () => {
    setServiceState(currentState => {
      const nextState: ServiceState = {
        ...currentState,
        config: {
          ...currentState.config,
          accessKey: generateAccessKey(),
        },
      };

      return currentState.phase === 'running'
        ? buildRunningState(nextState)
        : nextState;
    });
  };

  const setSecurityMode = (securityMode: 'simple' | 'secure') => {
    setServiceState(currentState => {
      const nextState: ServiceState = {
        ...currentState,
        config: {
          ...currentState.config,
          securityMode,
        },
      };

      return currentState.phase === 'running'
        ? buildRunningState(nextState)
        : nextState;
    });
  };

  const selectProject = (projectId: string) => {
    setServiceState(currentState => ({
      ...currentState,
      activeProjectId: projectId,
    }));
  };

  return {
    projects,
    refreshAddress,
    rotateKey,
    securityCopy,
    selectProject,
    serviceState,
    setSecurityMode,
    sharedFiles,
    toggleService,
  };
}
