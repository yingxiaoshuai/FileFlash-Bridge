import React from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Drawer, Menu } from 'react-native-paper';

import { styles } from '../appShellStyles';
import { PlatformQrCode } from '../components/PlatformQrCode';
import { setClipboardString } from '../../platform/clipboard';
import { AppIcon } from '../icons/AppIcons';
import type { AppIconName } from '../icons/AppIcons';
import { theme } from '../theme';
import {
  ActionButton,
  EmptyStateCard,
  GlyphIconButton,
  InlineMeta,
  PanelSurface,
} from '../ui';
import { useAppModel } from '../useAppModel';
import { GuidedTourTarget } from '../workspaceOnboarding';
import { createAppTranslator } from '../../modules/localization/i18n';
import type { AppLocale } from '../../modules/localization/i18n';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type {
  ProjectRecord,
  ServiceError,
  SharedFileRecord,
} from '../../modules/service/models';
import type { WorkspaceTourTargetId } from '../workspaceTypes';

type TranslateApp = ReturnType<typeof createAppTranslator>;
type AppModel = ReturnType<typeof useAppModel>;
type TourTargetNode = React.ElementRef<typeof View>;
type WorkspacePhaseId = 'service-startup' | 'content-sharing';

type WorkspacePhaseMetadata = {
  complete: boolean;
  id: WorkspacePhaseId;
  shortLabel: string;
  summary: string;
  title: string;
};

type HomeScreenProps = {
  activeTourTargetId?: WorkspaceTourTargetId;
  historyDrawerWidth: number;
  insets: EdgeInsets;
  isProjectHistoryOpen: boolean;
  model: AppModel;
  pagePadding: number;
  projectActionMenuId?: string;
  stackOverviewCards: boolean;
  tabBarPadding: number;
  targetLocale: AppLocale;
  targetLocaleLabel: string;
  t: TranslateApp;
  tourTargetCallbacks: Record<
    WorkspaceTourTargetId,
    (node: TourTargetNode | null) => void
  >;
  width: number;
  onOpenTour: () => void;
  onSelectLocale: (locale: AppLocale) => void;
  setProjectActionMenuId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  setProjectHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function HomeScreen({
  activeTourTargetId,
  historyDrawerWidth,
  insets,
  isProjectHistoryOpen,
  model,
  pagePadding,
  projectActionMenuId,
  stackOverviewCards,
  tabBarPadding,
  targetLocale,
  targetLocaleLabel,
  t,
  tourTargetCallbacks,
  width,
  onOpenTour,
  onSelectLocale,
  setProjectActionMenuId,
  setProjectHistoryOpen,
}: HomeScreenProps) {
  const isBusy = Boolean(model.busyAction);
  const [isSharedDownloadSelectionMode, setSharedDownloadSelectionMode] =
    React.useState(false);
  const [selectedSharedFileIds, setSelectedSharedFileIds] = React.useState<
    Set<string>
  >(() => new Set());
  const [renameProjectDraft, setRenameProjectDraft] = React.useState('');
  const [renameProjectId, setRenameProjectId] = React.useState<
    string | undefined
  >();
  const isCompactScreen = width < 560;
  const isServiceRunning = model.serviceState.phase === 'running';
  const isServiceStarting =
    model.serviceState.phase === 'starting' || model.busyAction === 'service';
  const securityModeLabel =
    model.serviceState.config.securityMode === 'secure'
      ? t('home.mode.secureDetailed')
      : t('home.mode.simpleDetailed');
  const localizedServiceError = localizeServiceError(
    model.serviceState.error,
    t,
  );
  const displayNetworkLabel = resolveNetworkLabel(
    model.serviceState.network.mode,
    model.serviceState.network.label,
    t,
  );
  const hasReachableAddress =
    Boolean(model.serviceState.accessUrl) &&
    model.serviceState.network.reachable;
  const serviceQrValue =
    model.serviceState.qrValue ?? model.serviceState.accessUrl;
  const isServiceReachable = isServiceRunning && hasReachableAddress;
  const workspacePhase = resolveWorkspacePhase(isServiceReachable);
  const isServiceStartupPhase = workspacePhase === 'service-startup';
  const isContentSharingPhase = workspacePhase === 'content-sharing';
  const startupActionLabel = isServiceStarting
    ? t('home.service.starting')
    : localizedServiceError
    ? t('home.service.retryStart')
    : t('home.service.start');
  const renameTargetProject = React.useMemo(
    () => model.projects.find(project => project.id === renameProjectId),
    [model.projects, renameProjectId],
  );
  const nextRenameTitle = renameProjectDraft.trim();
  const canSubmitRename = Boolean(
    renameTargetProject &&
      nextRenameTitle.length > 0 &&
      nextRenameTitle !== renameTargetProject.title,
  );
  const sharedFileIdSet = React.useMemo(
    () => new Set(model.sharedFiles.map(file => file.id)),
    [model.sharedFiles],
  );
  const workspaceFiles = React.useMemo(() => {
    const filesById = new Map<string, SharedFileRecord>();
    for (const file of model.activeProjectFiles) {
      filesById.set(file.id, file);
    }

    for (const file of model.sharedFiles) {
      filesById.set(file.id, file);
    }

    return Array.from(filesById.values()).sort((left, right) => {
      const leftShared = sharedFileIdSet.has(left.id);
      const rightShared = sharedFileIdSet.has(right.id);
      if (leftShared !== rightShared) {
        return leftShared ? -1 : 1;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [model.activeProjectFiles, model.sharedFiles, sharedFileIdSet]);
  const sharedWorkspaceFiles = React.useMemo(
    () => workspaceFiles.filter(file => sharedFileIdSet.has(file.id)),
    [sharedFileIdSet, workspaceFiles],
  );
  const unsharedWorkspaceFiles = React.useMemo(
    () => workspaceFiles.filter(file => !sharedFileIdSet.has(file.id)),
    [sharedFileIdSet, workspaceFiles],
  );
  const selectedSharedFiles = React.useMemo(
    () =>
      sharedWorkspaceFiles.filter(file => selectedSharedFileIds.has(file.id)),
    [selectedSharedFileIds, sharedWorkspaceFiles],
  );
  const selectedSharedFileCount = selectedSharedFiles.length;
  const workspaceFileCount = workspaceFiles.length;
  const workspaceSharedFileCount = sharedWorkspaceFiles.length;
  const contentSharingSummary = t('home.flow.fileSharingSummary', {
    files: workspaceFileCount,
    shared: workspaceSharedFileCount,
  });
  const contentPhaseMetadata: WorkspacePhaseMetadata = {
    complete: isContentSharingPhase,
    id: 'content-sharing',
    shortLabel: t('home.flow.stepContentSharing'),
    summary: contentSharingSummary,
    title: t('home.contentSharing.title'),
  };
  const startupScale = React.useRef(new Animated.Value(1)).current;
  const contentWorkspaceOpacity = React.useRef(
    new Animated.Value(isContentSharingPhase ? 1 : 0),
  ).current;
  const contentWorkspaceTranslateY = React.useRef(
    new Animated.Value(isContentSharingPhase ? 0 : 10),
  ).current;

  const animateStartupScale = React.useCallback(
    (toValue: number) => {
      Animated.spring(startupScale, {
        damping: 16,
        mass: 1,
        stiffness: 180,
        toValue,
        useNativeDriver: true,
      }).start();
    },
    [startupScale],
  );

  React.useEffect(() => {
    if (renameProjectId && !renameTargetProject) {
      setRenameProjectId(undefined);
      setRenameProjectDraft('');
    }
  }, [renameProjectId, renameTargetProject]);

  React.useEffect(() => {
    setSelectedSharedFileIds(current => {
      let changed = false;
      const next = new Set<string>();
      for (const fileId of current) {
        if (sharedFileIdSet.has(fileId)) {
          next.add(fileId);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });

    if (sharedWorkspaceFiles.length === 0) {
      setSharedDownloadSelectionMode(false);
    }
  }, [sharedFileIdSet, sharedWorkspaceFiles.length]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(contentWorkspaceOpacity, {
        duration: theme.tokens.duration.medium,
        easing: theme.tokens.easing.emphasized,
        toValue: isContentSharingPhase ? 1 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(contentWorkspaceTranslateY, {
        duration: theme.tokens.duration.medium,
        easing: theme.tokens.easing.emphasized,
        toValue: isContentSharingPhase ? 0 : 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    contentWorkspaceOpacity,
    contentWorkspaceTranslateY,
    isContentSharingPhase,
  ]);

  const handleToggleSharedDownloadSelection = (fileId: string) => {
    setSelectedSharedFileIds(current => {
      const next = new Set(current);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleSelectAllSharedDownloads = () => {
    setSelectedSharedFileIds(
      new Set(sharedWorkspaceFiles.map(file => file.id)),
    );
  };

  const handleClearSharedDownloadSelection = () => {
    setSelectedSharedFileIds(new Set());
  };

  const handleExitSharedDownloadSelection = () => {
    setSharedDownloadSelectionMode(false);
    handleClearSharedDownloadSelection();
  };

  const handleDownloadSelectedSharedFiles = () => {
    void model.exportFiles(selectedSharedFiles);
  };

  const handleCopyLink = () => {
    if (!model.serviceState.accessUrl) {
      Alert.alert(
        t('home.service.noAddressTitle'),
        t('home.service.noAddressBody'),
      );
      return;
    }

    setClipboardString(model.serviceState.accessUrl);
    Alert.alert(t('home.service.copiedTitle'), t('home.service.copiedBody'));
  };

  const handleShowSecurityModeHelp = () => {
    Alert.alert(
      t('home.service.securityModeHelpTitle'),
      t('home.service.securityModeHelpBody'),
    );
  };

  const confirmDeleteProject = (project: ProjectRecord) => {
    Alert.alert(t('home.project.deleteTitle'), model.deletionWarning, [
      {
        style: 'cancel',
        text: t('common.cancel'),
      },
      {
        onPress: () => {
          void model.deleteProject(project.id);
        },
        style: 'destructive',
        text: t('home.project.deleteConfirm'),
      },
    ]);
  };

  const handleOpenRenameProject = (project: ProjectRecord) => {
    setProjectActionMenuId(undefined);
    setRenameProjectId(project.id);
    setRenameProjectDraft(project.title);
  };

  const handleCloseRenameProject = () => {
    setRenameProjectId(undefined);
    setRenameProjectDraft('');
  };

  const handleSubmitRenameProject = () => {
    if (!renameTargetProject || !canSubmitRename) {
      return;
    }

    void (async () => {
      const didRename = await model.renameProject(
        renameTargetProject.id,
        nextRenameTitle,
      );
      if (didRename) {
        handleCloseRenameProject();
      }
    })();
  };

  return (
    <View style={styles.screenSection}>
      <View
        style={[
          styles.screenHeaderShell,
          {
            paddingHorizontal: pagePadding,
          },
        ]}
      >
        <View style={[styles.globalTopBar, styles.globalTopBarStacked]}>
          <IconButton
            accessibilityLabel={t('home.sidebar.open')}
            disabled={isBusy}
            icon="menu"
            onPress={() => {
              setProjectHistoryOpen(true);
            }}
            testID="sidebar-open"
          />
          <View style={styles.globalTopBarActions}>
            <View style={styles.localeMenuAnchor}>
              <GhostButton
                accessibilityLabel={t('settings.language.openMenu')}
                compact
                disabled={isBusy}
                label={targetLocaleLabel}
                onPress={() => {
                  onSelectLocale(targetLocale);
                }}
                testID="locale-menu-open"
              />
            </View>
            <GuidedTourTarget
              active={activeTourTargetId === 'help-button'}
              captureRef={tourTargetCallbacks['help-button']}
              style={styles.helpTargetWrap}
            >
              <IconButton
                accessibilityLabel={t('home.help.reopen')}
                disabled={isBusy}
                icon="help"
                onPress={onOpenTour}
                testID="workspace-open-onboarding"
              />
            </GuidedTourTarget>
            <StatusChip
              accent={
                isServiceRunning ? theme.colors.success : theme.colors.inkSoft
              }
              label={
                isServiceRunning
                  ? t('home.service.online')
                  : t('home.service.offline')
              }
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.page,
          {
            paddingHorizontal: pagePadding,
            paddingTop: 8,
            paddingBottom: tabBarPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.main,
            isServiceStartupPhase ? styles.mainStartup : styles.mainContent,
          ]}
        >
          <View
            style={[
              styles.topGrid,
              isServiceStartupPhase || stackOverviewCards
                ? styles.topGridCompact
                : null,
            ]}
          >
            {isServiceStartupPhase ? (
              <GuidedTourTarget
                active={activeTourTargetId === 'service-panel'}
                captureRef={tourTargetCallbacks['service-panel']}
                style={styles.startupTourTarget}
              >
                <PanelSurface
                  style={[
                    styles.card,
                    styles.serviceCard,
                    styles.serviceStartupCard,
                    styles.serviceStartupFocusCard,
                  ]}
                >
                  <View style={styles.startupNetworkRow}>
                    <NetworkTag
                      label={t('home.service.network')}
                      reachable={model.serviceState.network.reachable}
                      text={displayNetworkLabel}
                    />
                  </View>

                  <View style={styles.startupHero} testID="home-startup-step">
                    <Animated.View
                      style={[
                        styles.startupButtonStage,
                        {
                          transform: [{ scale: startupScale }],
                        },
                      ]}
                    >
                      <View pointerEvents="none" style={styles.startupHalo} />
                      <View
                        pointerEvents="none"
                        style={styles.startupHaloOuter}
                      />
                      <Pressable
                        accessibilityLabel={startupActionLabel}
                        accessibilityRole="button"
                        accessibilityState={{
                          busy: isServiceStarting,
                          disabled: isBusy,
                        }}
                        disabled={isBusy}
                        onPress={() => {
                          void model.toggleService();
                        }}
                        onPressIn={() => {
                          animateStartupScale(0.97);
                        }}
                        onPressOut={() => {
                          animateStartupScale(1);
                        }}
                        style={[
                          styles.startupCircle,
                          isServiceStarting ? styles.startupCircleBusy : null,
                          localizedServiceError
                            ? styles.startupCircleWarning
                            : null,
                        ]}
                        testID="home-toggle-service"
                      >
                        <View
                          pointerEvents="none"
                          style={styles.startupCircleShine}
                        />
                        <View
                          pointerEvents="none"
                          style={styles.startupCircleOrbit}
                        />
                        <Text style={styles.startupCircleKicker}>
                          {t('home.service.startStepKicker')}
                        </Text>
                        <Text style={styles.startupCircleLabel}>
                          {startupActionLabel}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  </View>

                  <View style={styles.serviceSecondaryPanel}>
                    <View
                      style={styles.serviceSecondaryRow}
                      testID="service-mode-panel"
                    >
                      <View style={styles.securityModeSwitchText}>
                        <View style={styles.securityModeTitleRow}>
                          <Text style={styles.quickToolsTitle}>
                            {t('home.service.accessMode')}
                          </Text>
                          <GlyphIconButton
                            accessibilityLabel={t(
                              'home.service.securityModeHelpTitle',
                            )}
                            disabled={isBusy}
                            iconName="info"
                            onPress={handleShowSecurityModeHelp}
                            testID="security-mode-help"
                          />
                        </View>
                        <Text style={styles.securityModeSwitchTitle}>
                          {securityModeLabel}
                        </Text>
                      </View>
                      <Switch
                        accessibilityLabel={t('home.service.securityMode')}
                        disabled={isBusy}
                        ios_backgroundColor={theme.colors.border}
                        onValueChange={nextSecure => {
                          void model.setSecurityMode(
                            nextSecure ? 'secure' : 'simple',
                          );
                        }}
                        thumbColor={theme.colors.surfaceElevated}
                        trackColor={{
                          false: theme.colors.border,
                          true: theme.colors.primary,
                        }}
                        value={
                          model.serviceState.config.securityMode === 'secure'
                        }
                      />
                    </View>
                  </View>
                </PanelSurface>
              </GuidedTourTarget>
            ) : null}

            {isContentSharingPhase ? (
              <Animated.View
                style={[
                  styles.contentWorkspaceMotion,
                  {
                    opacity: contentWorkspaceOpacity,
                    transform: [{ translateY: contentWorkspaceTranslateY }],
                  },
                ]}
              >
                <GuidedTourTarget
                  active={activeTourTargetId === 'content-sharing-panel'}
                  captureRef={tourTargetCallbacks['content-sharing-panel']}
                  style={styles.contentWorkspaceTourTarget}
                >
                  <View
                    style={styles.contentWorkspaceCard}
                    testID="content-sharing-panel"
                  >
                    <View style={styles.contentWorkspaceHeader}>
                      <View style={styles.contentWorkspaceHeaderMain}>
                        <SectionTitle title={contentPhaseMetadata.title} />
                        <Text
                          numberOfLines={2}
                          style={styles.contentWorkspaceMeta}
                        >
                          {contentPhaseMetadata.summary}
                        </Text>
                      </View>
                      <View style={styles.sharedFilesHeaderActions}>
                        <GhostButton
                          accessibilityLabel={t('home.shared.importFiles')}
                          compact
                          disabled={isBusy}
                          label={t('home.shared.importFiles')}
                          onPress={() => {
                            void model.importFilesForShare();
                          }}
                          style={styles.sharedHeaderActionButton}
                          testID="home-import-files"
                        />
                        <GhostButton
                          accessibilityLabel={t('home.shared.importMedia')}
                          compact
                          disabled={isBusy}
                          label={t('home.shared.importMedia')}
                          onPress={() => {
                            void model.importMediaForShare();
                          }}
                          style={styles.sharedHeaderActionButton}
                          testID="home-import-media"
                        />
                        {workspaceSharedFileCount > 0 ? (
                          <GhostButton
                            accessibilityLabel={
                              isSharedDownloadSelectionMode
                                ? t('home.shared.cancelSelection')
                                : t('home.shared.selectDownloads')
                            }
                            compact
                            disabled={isBusy}
                            label={
                              isSharedDownloadSelectionMode
                                ? t('home.shared.cancelSelection')
                                : t('home.shared.selectDownloads')
                            }
                            onPress={() => {
                              if (isSharedDownloadSelectionMode) {
                                handleExitSharedDownloadSelection();
                              } else {
                                setSharedDownloadSelectionMode(true);
                              }
                            }}
                            style={styles.sharedHeaderActionButton}
                            testID="home-shared-select-downloads"
                          />
                        ) : null}
                      </View>
                    </View>

                    {hasReachableAddress ? (
                      <GuidedTourTarget
                        active={activeTourTargetId === 'service-address'}
                        captureRef={tourTargetCallbacks['service-address']}
                        style={styles.contentServiceTarget}
                        testID="service-address-row"
                      >
                        <View style={styles.contentServiceAccessStack}>
                          <View style={styles.contentServiceStrip}>
                            <View style={styles.contentServiceStopCell}>
                              <Pressable
                                accessibilityLabel={t('home.service.stop')}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: isBusy }}
                                disabled={isBusy}
                                onPress={() => {
                                  void model.toggleService();
                                }}
                                style={({ pressed }) => [
                                  styles.contentServiceStopButton,
                                  pressed
                                    ? styles.contentServiceStopPressed
                                    : null,
                                  isBusy
                                    ? styles.contentServiceStopDisabled
                                    : null,
                                ]}
                                testID="home-toggle-service"
                              >
                                <Text style={styles.contentServiceStopLabel}>
                                  {stackActionLabel(t('home.service.stop'))}
                                </Text>
                              </Pressable>
                            </View>
                            <Text
                              selectable
                              style={styles.contentServiceAddress}
                            >
                              {model.serviceState.accessUrl}
                            </Text>
                            <View style={styles.contentServiceActions}>
                              <IconButton
                                accessibilityLabel={t('home.service.copyLink')}
                                disabled={isBusy}
                                icon="copy"
                                onPress={handleCopyLink}
                                testID="service-copy-link"
                              />
                              <IconButton
                                accessibilityLabel={t(
                                  'home.service.refreshAddress',
                                )}
                                disabled={isBusy}
                                icon="refresh"
                                onPress={() => {
                                  void model.refreshAddress();
                                }}
                                testID="service-refresh-address"
                              />
                            </View>
                          </View>
                          {serviceQrValue ? (
                            <View
                              accessibilityLabel={model.serviceState.accessUrl}
                              accessibilityRole="image"
                              style={styles.contentServiceQrPanel}
                              testID="service-address-qr"
                            >
                              <View style={styles.contentServiceQrFrame}>
                                <PlatformQrCode
                                  backgroundColor={theme.colors.surfaceElevated}
                                  color={theme.colors.ink}
                                  quietZone={6}
                                  size={168}
                                  value={serviceQrValue}
                                />
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </GuidedTourTarget>
                    ) : null}

                    <View
                      style={[
                        styles.contentWorkspaceSection,
                        styles.contentWorkspacePrimary,
                      ]}
                      testID="shared-files-panel"
                    >
                      <View style={styles.contentSectionHeader}>
                        <Text style={styles.subsectionTitle}>
                          {t('home.project.filesTitle')}
                        </Text>
                        <Text style={styles.contentSectionMeta}>
                          {contentSharingSummary}
                        </Text>
                      </View>

                      {isSharedDownloadSelectionMode ? (
                        <View style={styles.sharedSelectionToolbar}>
                          <Text style={styles.sharedSelectionCount}>
                            {t('home.shared.selectedCount', {
                              count: selectedSharedFileCount,
                            })}
                          </Text>
                          <View style={styles.sharedSelectionActions}>
                            <IconButton
                              accessibilityLabel={t('common.selectAll')}
                              disabled={isBusy}
                              icon="check"
                              onPress={handleSelectAllSharedDownloads}
                              testID="home-shared-select-all"
                            />
                            <IconButton
                              accessibilityLabel={t(
                                'home.shared.clearSelection',
                              )}
                              disabled={isBusy || selectedSharedFileCount === 0}
                              icon="close"
                              onPress={handleClearSharedDownloadSelection}
                              testID="home-shared-clear-selection"
                            />
                            <PrimaryButton
                              compact
                              disabled={isBusy}
                              label={t('home.shared.downloadSelected')}
                              onPress={handleDownloadSelectedSharedFiles}
                              testID="home-shared-download-selected"
                            />
                          </View>
                        </View>
                      ) : null}

                      <View
                        style={styles.workspaceFileGroups}
                        testID="project-panel"
                      >
                        {workspaceFiles.length === 0 ? (
                          <EmptyState title={t('home.project.filesEmpty')} />
                        ) : (
                          <>
                            {sharedWorkspaceFiles.length > 0 ? (
                              <FileGroup title={t('file.shared')}>
                                {sharedWorkspaceFiles.map(file => (
                                  <FileCard
                                    busy={
                                      isBusy &&
                                      (model.busyAction === 'share' ||
                                        model.busyAction === 'file' ||
                                        model.busyAction === 'export:batch' ||
                                        model.busyAction ===
                                          `export:${file.id}`)
                                    }
                                    compact={isCompactScreen}
                                    file={file}
                                    isShared
                                    key={file.id}
                                    locale={model.locale}
                                    onDelete={() => {
                                      void model.deleteFile(file.id);
                                    }}
                                    onExport={() => {
                                      void model.exportFile(file);
                                    }}
                                    onToggleSelected={() => {
                                      handleToggleSharedDownloadSelection(
                                        file.id,
                                      );
                                    }}
                                    onToggleShare={() => {
                                      void model.toggleSharedFile(file.id);
                                    }}
                                    selected={selectedSharedFileIds.has(
                                      file.id,
                                    )}
                                    selectionMode={
                                      isSharedDownloadSelectionMode
                                    }
                                    t={t}
                                  />
                                ))}
                              </FileGroup>
                            ) : null}

                            {unsharedWorkspaceFiles.length > 0 ? (
                              <FileGroup title={t('file.notShared')}>
                                {unsharedWorkspaceFiles.map(file => (
                                  <FileCard
                                    busy={
                                      isBusy &&
                                      (model.busyAction === 'share' ||
                                        model.busyAction === 'file' ||
                                        model.busyAction ===
                                          `export:${file.id}`)
                                    }
                                    compact={isCompactScreen}
                                    file={file}
                                    isShared={false}
                                    key={file.id}
                                    locale={model.locale}
                                    onDelete={() => {
                                      void model.deleteFile(file.id);
                                    }}
                                    onExport={() => {
                                      void model.exportFile(file);
                                    }}
                                    onToggleShare={() => {
                                      void model.toggleSharedFile(file.id);
                                    }}
                                    t={t}
                                  />
                                ))}
                              </FileGroup>
                            ) : null}
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </GuidedTourTarget>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {isProjectHistoryOpen ? (
        <View style={styles.sidebarOverlay} testID="sidebar-overlay">
          <Pressable
            onPress={() => {
              setProjectActionMenuId(undefined);
              setProjectHistoryOpen(false);
            }}
            style={styles.sidebarBackdrop}
            testID="sidebar-backdrop"
          />
          <View
            style={[
              styles.sidebarDrawerPanel,
              {
                paddingBottom: pagePadding + insets.bottom,
                paddingHorizontal: pagePadding,
                paddingTop: pagePadding,
                top: insets.top,
                width: historyDrawerWidth,
              },
            ]}
            testID="sidebar-panel"
          >
            <ScrollView
              contentContainerStyle={styles.sidebarDrawerScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <PanelSurface style={styles.sidebarPanel}>
                <View style={styles.sidebarListCard}>
                  <View style={styles.sidebarHeaderRow}>
                    <View style={styles.sidebarHeader}>
                      <Text style={styles.sidebarSectionTitle}>
                        {t('home.sidebar.title')}
                      </Text>
                      <Text style={styles.sidebarSectionMeta}>
                        {t('home.sidebar.count', {
                          count: model.projects.length,
                        })}
                      </Text>
                    </View>
                    <GhostButton
                      disabled={isBusy}
                      label={t('common.new')}
                      onPress={() => {
                        void model.createProject();
                      }}
                      testID="sidebar-create-project"
                    />
                  </View>
                  {model.projects.length === 0 ? (
                    <EmptyState title={t('home.sidebar.empty')} />
                  ) : (
                    <Drawer.Section style={styles.projectDrawerSection}>
                      {model.projects.map(project => (
                        <ProjectHistoryRow
                          active={project.id === model.activeProject?.id}
                          key={project.id}
                          lastItem={
                            project.id ===
                            model.projects[model.projects.length - 1]?.id
                          }
                          locale={model.locale}
                          menuLabel={t('home.sidebar.menu')}
                          menuVisible={projectActionMenuId === project.id}
                          onDelete={() => {
                            setProjectActionMenuId(undefined);
                            confirmDeleteProject(project);
                          }}
                          onDismissMenu={() => {
                            setProjectActionMenuId(undefined);
                          }}
                          onRename={() => {
                            handleOpenRenameProject(project);
                          }}
                          onOpenMenu={() => {
                            setProjectActionMenuId(project.id);
                          }}
                          onPress={() => {
                            setProjectActionMenuId(undefined);
                            void model.selectProject(project.id);
                          }}
                          project={project}
                          statusBarHeight={0}
                          t={t}
                        />
                      ))}
                    </Drawer.Section>
                  )}
                </View>
              </PanelSurface>
            </ScrollView>
          </View>
        </View>
      ) : null}
      {renameTargetProject ? (
        <View style={styles.dialogOverlay} testID="project-rename-dialog">
          <Pressable
            onPress={handleCloseRenameProject}
            style={styles.dialogBackdrop}
            testID="project-rename-backdrop"
          />
          <PanelSurface style={styles.renameDialogPanel}>
            <Text style={styles.renameDialogTitle}>
              {t('home.project.renameTitle')}
            </Text>
            <TextInput
              autoFocus
              editable={!isBusy}
              onChangeText={setRenameProjectDraft}
              placeholder={t('home.project.renamePlaceholder')}
              style={styles.renameDialogInput}
              testID="project-rename-input"
              value={renameProjectDraft}
            />
            <View style={styles.renameDialogActions}>
              <View style={styles.renameDialogActionCell}>
                <ActionButton
                  disabled={isBusy}
                  fullWidth
                  label={t('common.cancel')}
                  onPress={handleCloseRenameProject}
                  testID="project-rename-cancel"
                  tone="secondary"
                />
              </View>
              <View style={styles.renameDialogActionCell}>
                <ActionButton
                  disabled={!canSubmitRename || isBusy}
                  fullWidth
                  label={t('common.save')}
                  onPress={handleSubmitRenameProject}
                  testID="project-rename-submit"
                  tone="primary"
                />
              </View>
            </View>
          </PanelSurface>
        </View>
      ) : null}
    </View>
  );
}

type SectionTitleProps = {
  title: string;
};

function SectionTitle({ title }: SectionTitleProps) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function resolveWorkspacePhase(isServiceReachable: boolean): WorkspacePhaseId {
  return isServiceReachable ? 'content-sharing' : 'service-startup';
}

type NetworkTagProps = {
  label: string;
  reachable?: boolean;
  text: string;
};

function NetworkTag({ label, reachable = true, text }: NetworkTagProps) {
  return (
    <View
      style={[styles.networkTag, !reachable ? styles.networkTagWarning : null]}
    >
      <Text style={styles.networkTagLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.networkTagValue}>
        {text}
      </Text>
    </View>
  );
}

type StatusChipProps = {
  accent: string;
  label: string;
};

function StatusChip({ accent, label }: StatusChipProps) {
  return (
    <View style={[styles.statusChip, { borderColor: accent }]}>
      <View style={[styles.statusDot, { backgroundColor: accent }]} />
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

type ButtonProps = {
  accessibilityLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function PrimaryButton({
  accessibilityLabel,
  compact,
  disabled,
  fullWidth,
  label,
  onPress,
  style,
  testID,
}: ButtonProps) {
  return (
    <ActionButton
      accessibilityLabel={accessibilityLabel}
      compact={compact}
      disabled={disabled}
      fullWidth={fullWidth}
      label={label}
      onPress={onPress}
      style={style}
      testID={testID}
      tone="primary"
    />
  );
}

function GhostButton({
  accessibilityLabel,
  compact,
  disabled,
  fullWidth,
  label,
  onPress,
  style,
  testID,
}: ButtonProps) {
  return (
    <ActionButton
      accessibilityLabel={accessibilityLabel}
      compact={compact}
      disabled={disabled}
      fullWidth={fullWidth}
      label={label}
      onPress={onPress}
      style={style}
      testID={testID}
      tone="secondary"
    />
  );
}

function DangerGhostButton({
  accessibilityLabel,
  compact,
  disabled,
  fullWidth,
  label,
  onPress,
  style,
  testID,
}: ButtonProps) {
  return (
    <ActionButton
      accessibilityLabel={accessibilityLabel}
      compact={compact}
      disabled={disabled}
      fullWidth={fullWidth}
      label={label}
      onPress={onPress}
      style={style}
      testID={testID}
      tone="danger"
    />
  );
}

type IconButtonProps = Omit<ButtonProps, 'fullWidth' | 'label'> & {
  icon: AppIconName;
};

function IconButton({
  accessibilityLabel,
  disabled,
  icon,
  onPress,
  testID,
}: IconButtonProps) {
  return (
    <GlyphIconButton
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      iconName={icon}
      onPress={onPress}
      testID={testID}
    />
  );
}

type MenuTriggerButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
};

function MenuTriggerButton({
  accessibilityLabel,
  onPress,
  testID,
}: MenuTriggerButtonProps) {
  return (
    <GlyphIconButton
      accessibilityLabel={accessibilityLabel}
      iconName="more"
      onPress={onPress}
      testID={testID}
    />
  );
}

function stackActionLabel(label: string) {
  const trimmed = label.trim();

  if (/^[\u4e00-\u9fff]{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\n${trimmed.slice(2)}`;
  }

  const normalized = trimmed.replace(/\s+/g, ' ');
  const firstSpaceIndex = normalized.indexOf(' ');
  if (firstSpaceIndex > 0) {
    return `${normalized.slice(0, firstSpaceIndex)}\n${normalized.slice(
      firstSpaceIndex + 1,
    )}`;
  }

  return normalized;
}

type ProjectHistoryRowProps = {
  active: boolean;
  lastItem?: boolean;
  locale: string;
  menuLabel: string;
  menuVisible: boolean;
  onDelete: () => void;
  onDismissMenu: () => void;
  onRename: () => void;
  onOpenMenu: () => void;
  onPress: () => void;
  project: ProjectRecord;
  statusBarHeight?: number;
  t: TranslateApp;
};

function ProjectHistoryRow({
  active,
  lastItem,
  locale,
  menuLabel,
  menuVisible,
  onDelete,
  onDismissMenu,
  onRename,
  onOpenMenu,
  onPress,
  project,
  statusBarHeight,
  t,
}: ProjectHistoryRowProps) {
  return (
    <View
      style={[
        styles.projectHistoryRow,
        active ? styles.projectHistoryRowActive : null,
        !lastItem ? styles.projectHistoryRowDivider : null,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={styles.projectHistoryRowBody}
        testID={`project-drawer-item-${project.id}`}
      >
        <View style={styles.projectHistoryRowHeader}>
          <Text
            numberOfLines={1}
            style={[
              styles.projectHistoryRowTitle,
              active ? styles.projectHistoryRowTitleActive : null,
            ]}
          >
            {project.title}
          </Text>
          <Text style={styles.projectHistoryRowDate}>
            {formatDate(project.createdAt, locale)}
          </Text>
        </View>
        <InlineMeta style={styles.projectHistoryRowMetaWrap}>
          <Text
            style={[
              styles.projectHistoryRowMeta,
              active ? styles.projectHistoryRowMetaActive : null,
            ]}
          >
            {t('home.project.history.files', { count: project.fileIds.length })}
          </Text>
          <Text
            style={[
              styles.projectHistoryRowMeta,
              active ? styles.projectHistoryRowMetaActive : null,
            ]}
          >
            {t('home.project.history.messages', {
              count: project.messages.length,
            })}
          </Text>
        </InlineMeta>
      </Pressable>
      <Menu
        anchor={
          <MenuTriggerButton
            accessibilityLabel={menuLabel}
            onPress={onOpenMenu}
            testID={`project-row-menu-open-${project.id}`}
          />
        }
        anchorPosition="bottom"
        onDismiss={onDismissMenu}
        statusBarHeight={statusBarHeight}
        testID={`project-row-menu-${project.id}`}
        visible={menuVisible}
      >
        <Menu.Item
          onPress={onRename}
          testID={`project-row-menu-rename-${project.id}`}
          title={t('home.sidebar.renameProject')}
        />
        <Menu.Item
          onPress={onDelete}
          testID={`project-row-menu-delete-${project.id}`}
          title={t('home.sidebar.deleteProject')}
          titleStyle={styles.projectHistoryMenuDeleteLabel}
        />
      </Menu>
    </View>
  );
}

type FileGroupProps = {
  children: React.ReactNode;
  title: string;
};

function FileGroup({ children, title }: FileGroupProps) {
  return (
    <View style={styles.fileGroup}>
      <Text style={styles.fileGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

type FileCardProps = {
  busy?: boolean;
  compact?: boolean;
  file: SharedFileRecord;
  isShared: boolean;
  locale: string;
  onDelete: () => void;
  onExport: () => void;
  onToggleSelected?: () => void;
  onToggleShare: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  t: TranslateApp;
};

function FileCard({
  busy,
  compact,
  file,
  isShared,
  locale,
  onDelete,
  onExport,
  onToggleSelected,
  onToggleShare,
  selected,
  selectionMode,
  t,
}: FileCardProps) {
  const selectingSharedFile = Boolean(selectionMode && isShared);

  return (
    <PanelSurface
      style={[
        styles.fileCard,
        isShared ? styles.fileCardShared : styles.fileCardUnshared,
        selected ? styles.sharedFileCardSelected : null,
      ]}
    >
      <View
        style={[
          styles.fileCardHeader,
          compact ? styles.fileCardHeaderCompact : null,
        ]}
      >
        {selectingSharedFile ? (
          <Pressable
            accessibilityLabel={t('portal.download.select')}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: Boolean(selected), disabled: busy }}
            disabled={busy}
            onPress={onToggleSelected}
            style={[
              styles.sharedSelectionBox,
              selected ? styles.sharedSelectionBoxSelected : null,
            ]}
            testID={`shared-file-select-${file.id}`}
          >
            {selected ? (
              <AppIcon
                color={theme.colors.inkOnStrong}
                name="check"
                size={theme.tokens.iconSize.sm}
                strokeWidth={2.2}
              />
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          disabled={!selectingSharedFile || busy}
          onPress={onToggleSelected}
          style={styles.fileCardHeaderMain}
        >
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <View style={styles.fileMetaRow}>
            <Text
              style={styles.fileReceivedAt}
              testID={`file-received-at-${file.id}`}
            >
              {t('file.receivedAt', {
                date: formatDateTime(file.createdAt, locale),
              })}
            </Text>
            <Text style={styles.fileInlineMeta}>{formatBytes(file.size)}</Text>
            <Text
              style={[
                styles.fileTag,
                isShared ? styles.fileTagShared : styles.fileTagUnshared,
              ]}
            >
              {isShared ? t('file.shared') : t('file.notShared')}
            </Text>
          </View>
        </Pressable>
      </View>
      {!selectingSharedFile ? (
        <View style={styles.fileCardActionsRow}>
          <View style={styles.fileCardDeleteActionCell}>
            <DangerGhostButton
              compact
              disabled={busy}
              fullWidth
              label={t('common.delete')}
              onPress={onDelete}
              testID={`file-delete-${file.id}`}
            />
          </View>
          <View style={styles.fileCardActionCell}>
            <GhostButton
              accessibilityLabel={
                isShared ? t('file.removeFromShare') : t('file.addToShare')
              }
              compact
              disabled={busy}
              fullWidth
              label={
                isShared ? t('file.removeFromShare') : t('file.addToShare')
              }
              onPress={onToggleShare}
              testID={
                isShared
                  ? `shared-file-remove-${file.id}`
                  : `file-toggle-share-${file.id}`
              }
            />
          </View>
          <IconButton
            accessibilityLabel={
              isShared ? t('common.download') : t('common.export')
            }
            disabled={busy}
            icon="download"
            onPress={onExport}
            testID={
              isShared
                ? `shared-file-download-${file.id}`
                : `file-export-${file.id}`
            }
          />
        </View>
      ) : null}
    </PanelSurface>
  );
}

type EmptyStateProps = {
  title: string;
};

function EmptyState({ title }: EmptyStateProps) {
  return <EmptyStateCard title={title} />;
}

function formatBytes(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${size} B`;
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  if (locale.toLowerCase().startsWith('zh')) {
    return `${month}/${day} ${hour}:${minute}`;
  }

  return `${month}/${day} ${hour}:${minute}`;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = String(date.getFullYear());
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());

  if (locale.toLowerCase().startsWith('zh')) {
    return `${year}/${month}/${day}`;
  }

  return `${month}/${day}/${year}`;
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function localizeServiceError(
  error: ServiceError | undefined,
  t: TranslateApp,
) {
  if (!error) {
    return undefined;
  }

  switch (error.code) {
    case 'NETWORK_REFRESHED':
      return {
        ...error,
        message: t('api.networkRefreshed'),
        suggestedAction: t('api.useNewAddress'),
      };
    case 'NETWORK_UNAVAILABLE':
      return {
        ...error,
        message: t('api.networkUnavailable'),
        suggestedAction: t('api.switchNetworkRetry'),
      };
    case 'PORT_IN_USE':
    case 'SERVICE_STOPPED':
      return {
        ...error,
        suggestedAction: t('api.changePortOrStopConflict'),
      };
    case 'UNAUTHORIZED':
      return {
        ...error,
        message: t('api.unauthorized'),
      };
    case 'TEXT_TOO_LARGE':
      return {
        ...error,
        message: t('api.textTooLarge'),
      };
    default:
      return error;
  }
}

function resolveNetworkLabel(
  mode: string,
  fallbackLabel: string,
  t: TranslateApp,
) {
  if (mode === 'offline') {
    return t('home.network.mode.offline');
  }

  if (mode === 'unknown') {
    return t('home.network.mode.unknown');
  }

  return fallbackLabel;
}
