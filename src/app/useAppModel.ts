import Clipboard from '@react-native-clipboard/clipboard';
import {AppState} from 'react-native';
import {useEffect, useMemo, useRef, useState} from 'react';

import {
  InboundStorageGateway,
  SESSION_DELETION_WARNING,
} from '../modules/file-access/inboundStorageGateway';
import {
  createReactNativeInboundStorageGateway,
  exportPreparedFile,
  pickDeviceFilesForShare,
} from '../modules/file-access/reactNativeAdapters';
import {
  describeSecurityMode,
  generateAccessKey,
} from '../modules/security/accessControl';
import {
  DEFAULT_SERVICE_CONFIG,
  ProjectRecord,
  ServiceConfig,
  ServiceState,
  SharedFileRecord,
  StorageSnapshot,
  TextMessage,
  createInitialServiceState,
} from '../modules/service/models';
import {fetchNetworkInterfacesFromNetInfo} from '../modules/service/netInfoNetworkProvider';
import {createReactNativeHttpRuntime} from '../modules/service/reactNativeHttpRuntime';
import {TransferServiceController} from '../modules/service/transferServiceController';

type NoticeTone = 'info' | 'success' | 'error';

type AppNotice = {
  message: string;
  tone: NoticeTone;
};

type AppModelState = {
  busyAction?: string;
  isReady: boolean;
  notice?: AppNotice;
  serviceState: ServiceState;
  snapshot?: StorageSnapshot;
};

function createInitialConfig(): ServiceConfig {
  return {
    ...DEFAULT_SERVICE_CONFIG,
    accessKey: generateAccessKey(),
    sessionId: 'local-session',
  };
}

function buildNextProjectTitle(projects: ProjectRecord[]) {
  return `项目 ${projects.length + 1}`;
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '出现了未知错误，请稍后重试。';
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

export function useAppModel() {
  const configRef = useRef<ServiceConfig | null>(null);
  const gatewayRef = useRef<InboundStorageGateway | null>(null);
  const controllerRef = useRef<TransferServiceController | null>(null);
  const runtimeRef = useRef<ReturnType<typeof createReactNativeHttpRuntime> | null>(
    null,
  );

  if (!configRef.current) {
    configRef.current = createInitialConfig();
  }

  if (!gatewayRef.current) {
    gatewayRef.current = createReactNativeInboundStorageGateway(
      configRef.current.sessionId,
    );
  }

  if (!runtimeRef.current) {
    runtimeRef.current = createReactNativeHttpRuntime();
  }

  if (!controllerRef.current) {
    controllerRef.current = new TransferServiceController({
      config: configRef.current,
      networkProvider: fetchNetworkInterfacesFromNetInfo,
      runtime: runtimeRef.current,
      storage: gatewayRef.current,
    });
  }

  const [state, setState] = useState<AppModelState>(() => ({
    isReady: false,
    serviceState: createInitialServiceState(configRef.current!),
  }));

  const syncSnapshot = async (notice?: AppNotice, busyAction?: string) => {
    const snapshot = await gatewayRef.current!.getSnapshot();
    await controllerRef.current!.initialize();

    setState(currentState => ({
      ...currentState,
      busyAction,
      isReady: true,
      notice: notice ?? currentState.notice,
      serviceState: controllerRef.current!.getState(),
      snapshot,
    }));

    return snapshot;
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        await gatewayRef.current!.initialize();
        await controllerRef.current!.initialize();
        const snapshot = await gatewayRef.current!.getSnapshot();

        if (!active) {
          return;
        }

        setState({
          isReady: true,
          notice: undefined,
          serviceState: controllerRef.current!.getState(),
          snapshot,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState(currentState => ({
          ...currentState,
          busyAction: undefined,
          isReady: true,
          notice: {
            message: asErrorMessage(error),
            tone: 'error',
          },
        }));
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState !== 'active') {
        return;
      }

      void (async () => {
        try {
          const restoreResult = await controllerRef.current!.restoreIfNeeded();
          if (!restoreResult.restored) {
            return;
          }

          const snapshot = await gatewayRef.current!.getSnapshot();
          setState(currentState => ({
            ...currentState,
            notice: {
              message: '检测到后台期间服务中断，已自动恢复当前连接入口。',
              tone: 'info',
            },
            serviceState: restoreResult.state,
            snapshot,
          }));
        } catch (error) {
          setState(currentState => ({
            ...currentState,
            notice: {
              message: asErrorMessage(error),
              tone: 'error',
            },
          }));
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const securityCopy = useMemo(
    () => describeSecurityMode(state.serviceState.config.securityMode),
    [state.serviceState.config.securityMode],
  );

  const snapshot = state.snapshot;
  const projects = snapshot?.projects ?? [];
  const files = snapshot?.files ?? {};
  const activeProject = projects.find(
    project => project.id === snapshot?.activeProjectId,
  );
  const activeProjectFiles: SharedFileRecord[] = activeProject
    ? activeProject.fileIds
        .map(fileId => files[fileId])
        .filter(isDefined)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  const sharedFiles: SharedFileRecord[] = (snapshot?.sharedFileIds ?? [])
    .map(fileId => files[fileId])
    .filter(isDefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const sharedFileIds = new Set(snapshot?.sharedFileIds ?? []);

  const runAction = async (
    busyAction: string,
    action: () => Promise<void>,
    notice?: AppNotice,
  ) => {
    setState(currentState => ({
      ...currentState,
      busyAction,
    }));

    try {
      await action();
      await syncSnapshot(notice);
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: asErrorMessage(error),
          tone: 'error',
        },
      }));
    }
  };

  const toggleService = async () => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'service',
    }));

    try {
      const nextServiceState =
        state.serviceState.phase === 'running'
          ? await controllerRef.current!.stop()
          : await controllerRef.current!.start();

      const nextNotice =
        nextServiceState.phase === 'error'
          ? {
              message:
                nextServiceState.error?.message ?? '服务未能进入可用状态。',
              tone: 'error' as const,
            }
          : {
              message:
                nextServiceState.phase === 'running'
                  ? '服务状态已更新，当前会话内容可继续管理。'
                  : '服务已停止，外部连接已被清理。',
              tone: 'success' as const,
            };

      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: nextNotice,
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: asErrorMessage(error),
          tone: 'error',
        },
      }));
    }
  };

  const refreshAddress = async () => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'network',
    }));

    try {
      const nextServiceState = await controllerRef.current!.refreshAddress();
      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: nextServiceState.error
          ? {
              message: nextServiceState.error.message,
              tone: nextServiceState.phase === 'error' ? 'error' : 'info',
            }
          : {
              message: '访问地址已按当前网络环境刷新。',
              tone: 'success',
            },
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: asErrorMessage(error),
          tone: 'error',
        },
      }));
    }
  };

  const rotateKey = async () => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'security',
    }));

    try {
      const nextServiceState = await controllerRef.current!.rotateAccessKey();
      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: {
          message: '新的 key 已生成，旧链接和旧二维码立即失效。',
          tone: 'success',
        },
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: asErrorMessage(error),
          tone: 'error',
        },
      }));
    }
  };

  const setSecurityMode = async (securityMode: 'simple' | 'secure') => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'security',
    }));

    try {
      const nextServiceState =
        await controllerRef.current!.setSecurityMode(securityMode);
      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: {
          message:
            securityMode === 'secure'
              ? '已切换到安全模式，访问需要携带 key。'
              : '已切换到简单模式，建议只在可信网络中使用。',
          tone: 'info',
        },
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: asErrorMessage(error),
          tone: 'error',
        },
      }));
    }
  };

  const createProject = async () => {
    await runAction(
      'project',
      async () => {
        const currentSnapshot = await gatewayRef.current!.getSnapshot();
        await gatewayRef.current!.createProject(
          buildNextProjectTitle(currentSnapshot.projects),
        );
      },
      {
        message: '已创建新的文本分享项目，后续提交会进入这个项目。',
        tone: 'success',
      },
    );
  };

  const selectProject = async (projectId: string) => {
    await runAction('project', async () => {
      await gatewayRef.current!.setActiveProject(projectId);
    });
  };

  const toggleSharedFile = async (fileId: string) => {
    const isShared = sharedFileIds.has(fileId);
    await runAction(
      'share',
      async () => {
        if (isShared) {
          await gatewayRef.current!.removeSharedFile(fileId);
          return;
        }

        await gatewayRef.current!.addSharedFile(fileId);
      },
      {
        message: isShared
          ? '文件已从当前共享列表移除。'
          : '文件已加入当前共享列表，可供浏览器下载。',
        tone: 'success',
      },
    );
  };

  const importFilesForShare = async () => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'share',
    }));

    try {
      const importedFiles = await pickDeviceFilesForShare();
      if (importedFiles.length === 0) {
        setState(currentState => ({
          ...currentState,
          busyAction: undefined,
        }));
        return;
      }

      // Files chosen on the phone are treated the same as browser uploads:
      // they enter the current project first, then get added to the share list.
      for (const file of importedFiles) {
        const savedFile = await gatewayRef.current!.saveInboundFile({
          bytes: file.bytes,
          mimeType: file.mimeType,
          name: file.name,
          relativePath: file.relativePath,
        });
        await gatewayRef.current!.addSharedFile(savedFile.id);
      }

      await syncSnapshot({
        message: `已从本机选入 ${importedFiles.length} 个文件并加入共享列表。`,
        tone: 'success',
      });
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: asErrorMessage(error),
          tone: 'error',
        },
      }));
    }
  };

  const deleteMessage = async (projectId: string, messageId: string) => {
    await runAction(
      'message',
      async () => {
        await gatewayRef.current!.deleteMessage(projectId, messageId);
      },
      {
        message: '该条文本记录已删除。',
        tone: 'info',
      },
    );
  };

  const deleteProject = async (projectId: string) => {
    await runAction(
      'project',
      async () => {
        await gatewayRef.current!.deleteProject(projectId);
      },
      {
        message: '项目及其关联文件已删除。',
        tone: 'info',
      },
    );
  };

  const deleteFile = async (fileId: string) => {
    await runAction(
      'file',
      async () => {
        await gatewayRef.current!.deleteFile(fileId);
      },
      {
        message: '文件已从当前项目中删除。',
        tone: 'info',
      },
    );
  };

  const copyMessage = (message: TextMessage) => {
    Clipboard.setString(message.content);
    setState(currentState => ({
      ...currentState,
      notice: {
        message: '文本已复制到系统剪贴板。',
        tone: 'success',
      },
    }));
  };

  const exportFile = async (file: SharedFileRecord) => {
    setState(currentState => ({
      ...currentState,
      busyAction: `export:${file.id}`,
    }));

    try {
      const preparedFile = await gatewayRef.current!.prepareFileBytes(file.id);
      const result = await exportPreparedFile(preparedFile.file, preparedFile.bytes);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message:
            result.method === 'android-saf'
              ? `已保存到你选择的位置：${file.displayName}`
              : result.method === 'ios-files'
                ? `已打开“存储到文件”流程：${file.displayName}`
                : `已打开系统分享流程：${file.displayName}`,
          tone: 'success',
        },
      }));
    } catch (error) {
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: `导出失败：${asErrorMessage(error)}`,
          tone: 'error',
        },
      }));
    }
  };

  const clearNotice = () => {
    setState(currentState => ({
      ...currentState,
      notice: undefined,
    }));
  };

  return {
    activeProject,
    activeProjectFiles,
    busyAction: state.busyAction,
    clearNotice,
    copyMessage,
    createProject,
    deleteFile,
    deleteMessage,
    deleteProject,
    deletionWarning: SESSION_DELETION_WARNING,
    exportFile,
    importFilesForShare,
    isFileShared: (fileId: string) => sharedFileIds.has(fileId),
    isReady: state.isReady,
    notice: state.notice,
    projects,
    refreshAddress,
    rotateKey,
    securityCopy,
    selectProject,
    serviceState: state.serviceState,
    setSecurityMode,
    sharedFiles,
    toggleService,
    toggleSharedFile,
  };
}
