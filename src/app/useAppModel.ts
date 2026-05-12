import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  WORKSPACE_ONBOARDING_VERSION,
  WorkspaceOnboardingSnapshot,
} from '../modules/onboarding/models';
import {
  AppLocale,
  createAppTranslator,
  DEFAULT_APP_LOCALE,
} from '../modules/localization/i18n';
import { InboundStorageGateway } from '../modules/file-access/inboundStorageGateway';
import {
  cleanupImportedDeviceFiles,
  consumePendingSharedItems,
  exportStoredFile,
  exportPreparedFile,
  ImportedDeviceFile,
  ImportedDeviceText,
} from '../platform/fileAccess';
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
import {
  ServiceRuntime,
  TransferServiceController,
} from '../modules/service/transferServiceController';
import { setClipboardString } from '../platform/clipboard';
import {
  createPlatformInboundStorageGateway,
  pickPlatformFilesForShare,
  pickPlatformMediaForShare,
} from '../platform/fileAccess';
import { fetchPlatformNetworkInterfaces } from '../platform/networkProvider';
import { createPlatformServiceRuntime } from '../platform/serviceRuntime';
import { setPlatformIdleTimerDisabled } from '../platform/deviceState';

type NoticeTone = 'info' | 'success' | 'error';

type AppNotice = {
  message: string;
  tone: NoticeTone;
};

type AppModelState = {
  busyAction?: string;
  isReady: boolean;
  locale: AppLocale;
  notice?: AppNotice;
  onboarding: WorkspaceOnboardingViewState;
  serviceState: ServiceState;
  snapshot?: StorageSnapshot;
};

type WorkspaceOnboardingViewState = WorkspaceOnboardingSnapshot & {
  canReopen: boolean;
  isVisible: boolean;
  shouldAutoOpen: boolean;
};

function createInitialConfig(): ServiceConfig {
  return {
    ...DEFAULT_SERVICE_CONFIG,
    accessKey: generateAccessKey(),
    sessionId: 'local-session',
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildNextProjectTitle(projects: ProjectRecord[]) {
  return `项目 ${projects.length + 1}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function asErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '出现了未知错误，请稍后重试。';
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildImportedContentNotice(summary: {
  fileCount: number;
  textCount: number;
}) {
  if (summary.fileCount > 0 && summary.textCount > 0) {
    return `Received ${summary.fileCount} shared files and ${summary.textCount} shared notes.`;
  }

  if (summary.fileCount > 0) {
    return `Received ${summary.fileCount} shared files and added them to sharing.`;
  }

  if (summary.textCount > 0) {
    return `Received ${summary.textCount} shared notes and added them to the current project.`;
  }

  return '';
}

function resolveLocalizedErrorMessage(error: unknown, locale: AppLocale) {
  if (error instanceof Error) {
    return error.message;
  }

  return createAppTranslator(locale)('error.unknown');
}

function buildLocalizedProjectTitle(
  projects: ProjectRecord[],
  locale: AppLocale,
) {
  return createAppTranslator(locale)('project.defaultTitle', {
    count: projects.length + 1,
  });
}

function buildLocalizedImportedContentNotice(
  summary: {
    fileCount: number;
    textCount: number;
  },
  locale: AppLocale,
) {
  const t = createAppTranslator(locale);

  if (summary.fileCount > 0 && summary.textCount > 0) {
    return t('notice.imported.both', summary);
  }

  if (summary.fileCount > 0) {
    return t('notice.imported.files', summary);
  }

  if (summary.textCount > 0) {
    return t('notice.imported.texts', summary);
  }

  return '';
}

function createWorkspaceOnboardingViewState(
  snapshot?: WorkspaceOnboardingSnapshot,
  options?: { isVisible?: boolean },
): WorkspaceOnboardingViewState {
  const resolvedSnapshot: WorkspaceOnboardingSnapshot = snapshot ?? {
    status: 'unseen',
    version: WORKSPACE_ONBOARDING_VERSION,
  };

  return {
    ...resolvedSnapshot,
    canReopen: true,
    isVisible: options?.isVisible ?? false,
    shouldAutoOpen: resolvedSnapshot.status === 'unseen',
  };
}

export function useAppModel() {
  const configRef = useRef<ServiceConfig | null>(null);
  const gatewayRef = useRef<InboundStorageGateway | null>(null);
  const controllerRef = useRef<TransferServiceController | null>(null);
  const runtimeRef = useRef<ServiceRuntime | null>(null);

  if (!configRef.current) {
    configRef.current = createInitialConfig();
  }

  if (!gatewayRef.current) {
    gatewayRef.current = createPlatformInboundStorageGateway(
      configRef.current.sessionId,
    );
  }

  if (!runtimeRef.current) {
    runtimeRef.current = createPlatformServiceRuntime();
  }

  if (!controllerRef.current) {
    controllerRef.current = new TransferServiceController({
      config: configRef.current,
      networkProvider: fetchPlatformNetworkInterfaces,
      resolveInboundStorageChangeHandler: () => async () => {
        const gateway = gatewayRef.current;
        if (!gateway) {
          return;
        }

        const snapshot = await gateway.getSnapshot();
        setState(current => ({
          ...current,
          serviceState:
            controllerRef.current?.getState() ?? current.serviceState,
          snapshot,
        }));
      },
      runtime: runtimeRef.current,
      storage: gatewayRef.current,
    });
  }

  const [state, setState] = useState<AppModelState>(() => ({
    isReady: false,
    locale: DEFAULT_APP_LOCALE,
    onboarding: createWorkspaceOnboardingViewState(),
    serviceState: createInitialServiceState(configRef.current!),
  }));
  const stateRef = useRef(state);
  stateRef.current = state;

  const resolveCurrentErrorMessage = (error: unknown) =>
    resolveLocalizedErrorMessage(
      error,
      stateRef.current?.locale ?? DEFAULT_APP_LOCALE,
    );

  const createErrorNotice = (error: unknown): AppNotice => ({
    message: resolveCurrentErrorMessage(error),
    tone: 'error',
  });

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

  const persistImportedContent = useCallback(
    async (content: {
      files: ImportedDeviceFile[];
      texts: ImportedDeviceText[];
    }) => {
      const gateway = gatewayRef.current!;
      let fileCount = 0;
      let textCount = 0;

      for (const text of content.texts) {
        await gateway.appendTextMessage(text.content, undefined, {
          createdAt: text.createdAt,
          source: 'app',
        });
        textCount += 1;
      }

      for (const file of content.files) {
        const savedFile = await gateway.saveInboundFile({
          byteLength: file.byteLength,
          createdAt: file.createdAt,
          mimeType: file.mimeType,
          name: file.name,
          relativePath: file.relativePath,
          sourcePath: file.sourcePath,
        });
        await gateway.addSharedFile(savedFile.id);
        fileCount += 1;
      }

      return {
        fileCount,
        textCount,
      };
    },
    [],
  );

  const importPendingSystemSharedItems = useCallback(async () => {
    const content = await consumePendingSharedItems();
    if (content.files.length === 0 && content.texts.length === 0) {
      return {
        fileCount: 0,
        textCount: 0,
      };
    }

    try {
      return await persistImportedContent(content);
    } finally {
      await cleanupImportedDeviceFiles(content.files);
    }
  }, [persistImportedContent]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        await gatewayRef.current!.initialize();
        await controllerRef.current!.initialize();
        const locale = await gatewayRef.current!.getLocalePreference();
        const importedSummary = await importPendingSystemSharedItems();
        const snapshot = await gatewayRef.current!.getSnapshot();
        const onboarding =
          await gatewayRef.current!.getWorkspaceOnboardingState(
            WORKSPACE_ONBOARDING_VERSION,
          );

        if (!active) {
          return;
        }

        setState({
          isReady: true,
          locale,
          notice:
            importedSummary.fileCount > 0 || importedSummary.textCount > 0
              ? {
                  message: buildLocalizedImportedContentNotice(
                    importedSummary,
                    locale,
                  ),
                  tone: 'success',
                }
              : undefined,
          onboarding: createWorkspaceOnboardingViewState(onboarding, {
            isVisible: onboarding.status === 'unseen',
          }),
          serviceState: controllerRef.current!.getState(),
          snapshot,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        const errorNotice = createErrorNotice(error);
        setState(currentState => ({
          ...currentState,
          busyAction: undefined,
          isReady: true,
          notice: errorNotice,
        }));
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [importPendingSystemSharedItems]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState !== 'active') {
        return;
      }

      void (async () => {
        try {
          const restoreResult = await controllerRef.current!.restoreIfNeeded();
          const importedSummary = await importPendingSystemSharedItems();
          const locale = await gatewayRef.current!.getLocalePreference();
          const hasImportedContent =
            importedSummary.fileCount > 0 || importedSummary.textCount > 0;
          if (!restoreResult.restored && !hasImportedContent) {
            return;
          }

          const snapshot = await gatewayRef.current!.getSnapshot();
          setState(currentState => ({
            ...currentState,
            locale,
            notice: hasImportedContent
              ? {
                  message: buildLocalizedImportedContentNotice(
                    importedSummary,
                    locale,
                  ),
                  tone: 'success',
                }
              : {
                  message: createAppTranslator(locale)(
                    'notice.resumedForeground',
                  ),
                  tone: 'info',
                },
            serviceState: restoreResult.state,
            snapshot,
          }));
        } catch (error) {
          const errorNotice = createErrorNotice(error);
          setState(currentState => ({
            ...currentState,
            notice: errorNotice,
          }));
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [importPendingSystemSharedItems]);

  useEffect(() => {
    const shouldKeepScreenAwake = state.serviceState.phase === 'running';
    setPlatformIdleTimerDisabled(shouldKeepScreenAwake);

    return () => {
      setPlatformIdleTimerDisabled(false);
    };
  }, [state.serviceState.phase]);

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
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: errorNotice,
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

      const localizedNextNotice =
        nextServiceState.phase === 'error'
          ? nextNotice
          : {
              ...nextNotice,
              message:
                nextServiceState.phase === 'running'
                  ? createAppTranslator(state.locale)('notice.serviceStarted')
                  : createAppTranslator(state.locale)('notice.serviceStopped'),
            };

      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: localizedNextNotice,
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: errorNotice,
      }));
    }
  };

  const refreshAddress = async () => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'network',
    }));

    try {
      const nextServiceState = await controllerRef.current!.refreshAddress({
        rotateAccessKey: true,
      });
      const localizedRefreshNotice: AppNotice = nextServiceState.error
        ? {
            message: nextServiceState.error.message,
            tone: nextServiceState.phase === 'error' ? 'error' : 'info',
          }
        : {
            message: createAppTranslator(state.locale)(
              'notice.addressRefreshed',
            ),
            tone: 'success',
          };
      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: localizedRefreshNotice,
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: errorNotice,
      }));
    }
  };

  const setSecurityMode = async (securityMode: 'simple' | 'secure') => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'security',
    }));

    try {
      const nextServiceState = await controllerRef.current!.setSecurityMode(
        securityMode,
      );
      const localizedSecurityNotice: AppNotice | undefined =
        securityMode === 'secure'
          ? {
              message: createAppTranslator(state.locale)(
                'notice.securityModeSecure',
              ),
              tone: 'info',
            }
          : undefined;
      const nextSnapshot = await gatewayRef.current!.getSnapshot();
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        isReady: true,
        notice: localizedSecurityNotice,
        serviceState: nextServiceState,
        snapshot: nextSnapshot,
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: errorNotice,
        serviceState: controllerRef.current!.getState(),
      }));
    }
  };

  const createProject = async () => {
    await runAction(
      'project',
      async () => {
        const currentSnapshot = await gatewayRef.current!.getSnapshot();
        await gatewayRef.current!.createProject(
          buildLocalizedProjectTitle(currentSnapshot.projects, state.locale),
        );
      },
      {
        message: '已创建新的文本分享项目，后续提交会进入这个项目。',
        tone: 'success',
      },
    );

    setState(currentState => ({
      ...currentState,
      notice: {
        message: createAppTranslator(currentState.locale)(
          'notice.projectCreated',
        ),
        tone: 'success',
      },
    }));
  };

  const selectProject = async (projectId: string) => {
    await runAction('project', async () => {
      await gatewayRef.current!.setActiveProject(projectId);
    });
  };

  const renameProject = async (projectId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return false;
    }

    setState(currentState => ({
      ...currentState,
      busyAction: 'project',
    }));

    try {
      await gatewayRef.current!.renameProject(projectId, trimmedTitle);
      await syncSnapshot({
        message: createAppTranslator(state.locale)('notice.projectRenamed'),
        tone: 'success',
      });
      return true;
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: errorNotice,
      }));
      return false;
    }
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

    setState(currentState => ({
      ...currentState,
      notice: {
        message: createAppTranslator(currentState.locale)(
          isShared ? 'notice.fileUnshared' : 'notice.fileShared',
        ),
        tone: 'success',
      },
    }));
  };

  const importExternalFiles = async (
    picker: () => Promise<ImportedDeviceFile[]>,
    buildNotice: (count: number) => string,
  ) => {
    setState(currentState => ({
      ...currentState,
      busyAction: 'share',
    }));

    let importedFiles: ImportedDeviceFile[] = [];

    try {
      importedFiles = await picker();
      if (importedFiles.length === 0) {
        setState(currentState => ({
          ...currentState,
          busyAction: undefined,
        }));
        return;
      }

      const summary = await persistImportedContent({
        files: importedFiles,
        texts: [],
      });

      await syncSnapshot({
        message: buildNotice(summary.fileCount),
        tone: 'success',
      });
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: errorNotice,
      }));
    } finally {
      await cleanupImportedDeviceFiles(importedFiles);
    }
  };

  const importFilesForShare = async () => {
    await importExternalFiles(pickPlatformFilesForShare, count =>
      createAppTranslator(state.locale)('notice.importFiles', {
        count,
      }),
    );
  };

  const importMediaForShare = async () => {
    await importExternalFiles(pickPlatformMediaForShare, count =>
      createAppTranslator(state.locale)('notice.importMedia', {
        count,
      }),
    );
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

    setState(currentState => ({
      ...currentState,
      notice: {
        message: createAppTranslator(currentState.locale)(
          'notice.messageDeleted',
        ),
        tone: 'info',
      },
    }));
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

    setState(currentState => ({
      ...currentState,
      notice: {
        message: createAppTranslator(currentState.locale)(
          'notice.projectDeleted',
        ),
        tone: 'info',
      },
    }));
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

    setState(currentState => ({
      ...currentState,
      notice: {
        message: createAppTranslator(currentState.locale)('notice.fileDeleted'),
        tone: 'info',
      },
    }));
  };

  const copyMessage = (message: TextMessage) => {
    setClipboardString(message.content);
    const copiedNotice = {
      message: createAppTranslator(state.locale)('notice.textCopied'),
      tone: 'success' as const,
    };
    setState(currentState => ({
      ...currentState,
      notice: {
        message: '文本已复制到系统剪贴板。',
        tone: 'success',
      },
    }));
    setState(currentState => ({
      ...currentState,
      notice: copiedNotice,
    }));
  };

  const exportFile = async (file: SharedFileRecord) => {
    setState(currentState => ({
      ...currentState,
      busyAction: `export:${file.id}`,
    }));

    try {
      const result =
        file.compression === 'none'
          ? await exportStoredFile(file)
          : await (async () => {
              const preparedFile = await gatewayRef.current!.prepareFileBytes(
                file.id,
              );
              return exportPreparedFile(preparedFile.file, preparedFile.bytes);
            })();
      const localizedExportNotice = {
        message:
          result.method === 'android-saf'
            ? createAppTranslator(state.locale)('notice.export.saved', {
                name: file.displayName,
              })
            : result.method === 'ios-files'
            ? createAppTranslator(state.locale)('notice.export.ios', {
                name: file.displayName,
              })
            : createAppTranslator(state.locale)('notice.export.share', {
                name: file.displayName,
              }),
        tone: 'success' as const,
      };
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
      setState(currentState => ({
        ...currentState,
        notice: localizedExportNotice,
      }));
    } catch (error) {
      const locale = stateRef.current?.locale ?? DEFAULT_APP_LOCALE;
      const errorMessage = resolveCurrentErrorMessage(error);
      setState(currentState => ({
        ...currentState,
        busyAction: undefined,
        notice: {
          message: createAppTranslator(locale)('error.exportFailed', {
            message: errorMessage,
          }),
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

  const openWorkspaceOnboarding = async () => {
    try {
      const onboarding =
        await gatewayRef.current!.recordManualWorkspaceOnboardingOpen(
          WORKSPACE_ONBOARDING_VERSION,
        );

      setState(currentState => ({
        ...currentState,
        onboarding: createWorkspaceOnboardingViewState(onboarding, {
          isVisible: true,
        }),
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        notice: errorNotice,
      }));
    }
  };

  const skipWorkspaceOnboarding = async () => {
    try {
      const onboarding =
        await gatewayRef.current!.markWorkspaceOnboardingSkipped(
          WORKSPACE_ONBOARDING_VERSION,
        );

      setState(currentState => ({
        ...currentState,
        onboarding: createWorkspaceOnboardingViewState(onboarding),
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        notice: errorNotice,
      }));
    }
  };

  const completeWorkspaceOnboarding = async () => {
    try {
      const onboarding =
        await gatewayRef.current!.markWorkspaceOnboardingCompleted(
          WORKSPACE_ONBOARDING_VERSION,
        );

      setState(currentState => ({
        ...currentState,
        onboarding: createWorkspaceOnboardingViewState(onboarding),
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        notice: errorNotice,
      }));
    }
  };

  const setLocale = async (locale: AppLocale) => {
    if (locale === state.locale) {
      return;
    }

    try {
      await gatewayRef.current!.setLocalePreference(locale);
      setState(currentState => ({
        ...currentState,
        locale,
      }));
    } catch (error) {
      const errorNotice = createErrorNotice(error);
      setState(currentState => ({
        ...currentState,
        notice: errorNotice,
      }));
    }
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
    deletionWarning: createAppTranslator(state.locale)(
      'home.project.deleteBody',
    ),
    exportFile,
    importFilesForShare,
    importMediaForShare,
    isFileShared: (fileId: string) => sharedFileIds.has(fileId),
    isReady: state.isReady,
    locale: state.locale,
    notice: state.notice,
    onboarding: state.onboarding,
    openWorkspaceOnboarding,
    projects,
    refreshAddress,
    renameProject,
    securityCopy,
    selectProject,
    setLocale,
    serviceState: state.serviceState,
    setSecurityMode,
    sharedFiles,
    completeWorkspaceOnboarding,
    skipWorkspaceOnboarding,
    toggleService,
    toggleSharedFile,
  };
}
