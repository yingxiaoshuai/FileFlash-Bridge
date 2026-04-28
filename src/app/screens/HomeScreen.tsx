import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Drawer, Menu } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import { styles } from '../appShellStyles';
import {
  WorkspaceConnectionsIcon,
  WorkspaceSecurityIcon,
  WorkspaceSharedIcon,
} from '../icons/AppIcons';
import { setClipboardString } from '../../platform/clipboard';
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
import {
  APP_LOCALE_OPTIONS,
  createAppTranslator,
} from '../../modules/localization/i18n';
import type { AppLocale } from '../../modules/localization/i18n';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type {
  ProjectRecord,
  ServiceError,
  SharedFileRecord,
  TextMessage,
} from '../../modules/service/models';
import type { WorkspaceTourTargetId } from '../workspaceTypes';

type TranslateApp = ReturnType<typeof createAppTranslator>;
type AppModel = ReturnType<typeof useAppModel>;
type TourTargetNode = React.ElementRef<typeof View>;

type HomeScreenProps = {
  activeTourTargetId?: WorkspaceTourTargetId;
  currentLocaleLabel: string;
  historyDrawerWidth: number;
  insets: EdgeInsets;
  isLocaleMenuVisible: boolean;
  isProjectHistoryOpen: boolean;
  model: AppModel;
  pagePadding: number;
  projectActionMenuId?: string;
  serviceQrSize: number;
  stackOverviewCards: boolean;
  stackProjectPanels: boolean;
  tabBarPadding: number;
  t: TranslateApp;
  tourTargetCallbacks: Record<
    WorkspaceTourTargetId,
    (node: TourTargetNode | null) => void
  >;
  width: number;
  onOpenTour: () => void;
  onSelectLocale: (locale: AppLocale) => void;
  setLocaleMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectActionMenuId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  setProjectHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function HomeScreen({
  activeTourTargetId,
  currentLocaleLabel,
  historyDrawerWidth,
  insets,
  isLocaleMenuVisible,
  isProjectHistoryOpen,
  model,
  pagePadding,
  projectActionMenuId,
  serviceQrSize,
  stackOverviewCards,
  stackProjectPanels,
  tabBarPadding,
  t,
  tourTargetCallbacks,
  width,
  onOpenTour,
  onSelectLocale,
  setLocaleMenuVisible,
  setProjectActionMenuId,
  setProjectHistoryOpen,
}: HomeScreenProps) {
  const isBusy = Boolean(model.busyAction);
  const [renameProjectDraft, setRenameProjectDraft] = React.useState('');
  const [renameProjectId, setRenameProjectId] = React.useState<
    string | undefined
  >();
  const isCompactScreen = width < 560;
  const isServiceRunning = model.serviceState.phase === 'running';
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
  const stoppedAddressCopy = model.serviceState.network.reachable
    ? t('home.service.addressPlaceholder')
    : localizedServiceError?.message ?? displayNetworkLabel;
  const projectTitleById = React.useMemo(
    () => new Map(model.projects.map(project => [project.id, project.title])),
    [model.projects],
  );
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

  React.useEffect(() => {
    if (renameProjectId && !renameTargetProject) {
      setRenameProjectId(undefined);
      setRenameProjectDraft('');
    }
  }, [renameProjectId, renameTargetProject]);

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
            icon="☰"
            onPress={() => {
              setProjectHistoryOpen(true);
            }}
            testID="sidebar-open"
          />
          <View style={styles.globalTopBarActions}>
            <Menu
              anchor={
                <View style={styles.localeMenuAnchor}>
                  <GhostButton
                    accessibilityLabel={t('settings.language.openMenu')}
                    compact
                    disabled={isBusy}
                    label={`${currentLocaleLabel} ▾`}
                    onPress={() => {
                      setLocaleMenuVisible(true);
                    }}
                    testID="locale-menu-open"
                  />
                </View>
              }
              anchorPosition="bottom"
              onDismiss={() => {
                setLocaleMenuVisible(false);
              }}
              statusBarHeight={0}
              testID="locale-menu"
              visible={isLocaleMenuVisible}
            >
              {APP_LOCALE_OPTIONS.map(option => (
                <Menu.Item
                  key={option.value}
                  onPress={() => {
                    onSelectLocale(option.value);
                  }}
                  testID={`locale-menu-item-${option.value}`}
                  title={t(option.labelKey)}
                  titleStyle={
                    option.value === model.locale
                      ? styles.localeMenuItemActiveLabel
                      : undefined
                  }
                />
              ))}
            </Menu>
            <GuidedTourTarget
              active={activeTourTargetId === 'help-button'}
              captureRef={tourTargetCallbacks['help-button']}
              style={styles.helpTargetWrap}
            >
              <IconButton
                accessibilityLabel={t('home.help.reopen')}
                disabled={isBusy}
                icon="?"
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
        <View style={styles.main}>
          <PanelSurface style={styles.summaryShell}>
            <View style={styles.header}>
              <View style={styles.headerMain}>
                <Text
                  style={[
                    styles.headerTitle,
                    isCompactScreen ? styles.headerTitleCompact : null,
                  ]}
                >
                  {t('home.header.title')}
                </Text>
                <Text numberOfLines={1} style={styles.headerMeta}>
                  {model.activeProject?.title ?? t('home.header.noProject')}
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <InfoBadge
                compact={isCompactScreen}
                icon={<WorkspaceConnectionsIcon size={22} />}
                label={t('home.metric.connections')}
                testID="workspace-summary-connections"
                value={String(model.serviceState.activeConnections.length)}
              />
              <InfoBadge
                compact={isCompactScreen}
                icon={<WorkspaceSharedIcon size={22} />}
                label={t('home.metric.shared')}
                testID="workspace-summary-shared"
                value={String(model.sharedFiles.length)}
              />
              <InfoBadge
                compact={isCompactScreen}
                icon={
                  <WorkspaceSecurityIcon
                    secure={model.serviceState.config.securityMode === 'secure'}
                    size={22}
                  />
                }
                label={t('home.metric.mode')}
                testID="workspace-summary-mode"
                value={
                  model.serviceState.config.securityMode === 'secure'
                    ? t('home.mode.secure')
                    : t('home.mode.simple')
                }
                valueColor={
                  model.serviceState.config.securityMode === 'secure'
                    ? theme.colors.success
                    : undefined
                }
              />
            </View>
          </PanelSurface>

          <View
            style={[
              styles.topGrid,
              stackOverviewCards ? styles.topGridCompact : null,
            ]}
          >
            <GuidedTourTarget
              active={activeTourTargetId === 'service-panel'}
              captureRef={tourTargetCallbacks['service-panel']}
              style={styles.topGridTourTarget}
            >
              <PanelSurface style={[styles.card, styles.serviceCard]}>
                <View style={styles.serviceHeaderRow}>
                  <View style={styles.serviceHeaderTitleWrap}>
                    <SectionTitle title={t('home.service.title')} />
                  </View>
                  <NetworkTag
                    label={t('home.service.network')}
                    reachable={model.serviceState.network.reachable}
                    text={displayNetworkLabel}
                  />
                </View>

                {hasReachableAddress ? (
                  <GuidedTourTarget
                    active={activeTourTargetId === 'service-address'}
                    captureRef={tourTargetCallbacks['service-address']}
                    style={styles.serviceAddressTarget}
                    testID="service-address-row"
                  >
                    <View style={styles.serviceAddressSection}>
                      <KeyValueTile
                        fill
                        label={t('home.service.address')}
                        value={model.serviceState.accessUrl!}
                      />
                      <View style={styles.serviceAddressActions}>
                        <IconButton
                          accessibilityLabel={t('home.service.copyLink')}
                          disabled={isBusy}
                          icon="⎘"
                          onPress={handleCopyLink}
                          testID="service-copy-link"
                        />
                        <IconButton
                          accessibilityLabel={t('home.service.refreshAddress')}
                          disabled={isBusy}
                          icon="↻"
                          onPress={() => {
                            void model.refreshAddress();
                          }}
                          testID="service-refresh-address"
                        />
                      </View>
                    </View>
                  </GuidedTourTarget>
                ) : (
                  <View
                    style={styles.serviceAddressCollapsed}
                    testID="service-address-collapsed"
                  >
                    <Text style={styles.serviceAddressCollapsedLabel}>
                      {t('home.service.address')}
                    </Text>
                    <Text style={styles.serviceAddressCollapsedValue}>
                      {stoppedAddressCopy}
                    </Text>
                  </View>
                )}

                <PrimaryButton
                  disabled={isBusy}
                  fullWidth
                  label={
                    isServiceRunning
                      ? t('home.service.stop')
                      : t('home.service.start')
                  }
                  onPress={() => {
                    void model.toggleService();
                  }}
                  testID="home-toggle-service"
                />

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
                          glyph="!"
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

                {model.serviceState.qrValue && hasReachableAddress ? (
                  <View style={styles.qrPanel}>
                    <QRCode
                      backgroundColor={theme.colors.surface}
                      color={theme.colors.ink}
                      size={serviceQrSize}
                      value={model.serviceState.qrValue}
                    />
                  </View>
                ) : null}
              </PanelSurface>
            </GuidedTourTarget>

            <GuidedTourTarget
              active={activeTourTargetId === 'shared-files-panel'}
              captureRef={tourTargetCallbacks['shared-files-panel']}
              style={styles.topGridTourTarget}
            >
              <PanelSurface style={[styles.card, styles.sharedFilesCard]}>
                <View style={styles.cardHeaderRow}>
                  <SectionTitle title={t('home.shared.title')} />
                  <View style={styles.sharedFilesHeaderActions}>
                    <GhostButton
                      compact
                      disabled={isBusy}
                      label={t('home.shared.importFiles')}
                      onPress={() => {
                        void model.importFilesForShare();
                      }}
                      testID="home-import-files"
                    />
                    <GhostButton
                      compact
                      disabled={isBusy}
                      label={t('home.shared.importMedia')}
                      onPress={() => {
                        void model.importMediaForShare();
                      }}
                      testID="home-import-media"
                    />
                  </View>
                </View>

                {model.sharedFiles.length === 0 ? (
                  <EmptyState title={t('home.shared.empty')} />
                ) : (
                  model.sharedFiles.map(file => (
                    <SharedListCard
                      busy={
                        isBusy &&
                        (model.busyAction === 'share' ||
                          model.busyAction === `export:${file.id}`)
                      }
                      compact={isCompactScreen}
                      file={file}
                      key={`shared-${file.id}`}
                      locale={model.locale}
                      onExport={() => {
                        void model.exportFile(file);
                      }}
                      onRemoveShare={() => {
                        void model.toggleSharedFile(file.id);
                      }}
                      projectTitle={
                        projectTitleById.get(file.projectId) ??
                        t('home.shared.unnamedProject')
                      }
                      t={t}
                    />
                  ))
                )}
              </PanelSurface>
            </GuidedTourTarget>
          </View>

          <GuidedTourTarget
            active={activeTourTargetId === 'project-panel'}
            captureRef={tourTargetCallbacks['project-panel']}
            style={styles.projectTourTarget}
          >
            <PanelSurface style={styles.card}>
              {model.activeProject ? (
                <>
                  <View style={styles.activeProjectHeaderMain}>
                    <Text style={styles.activeProjectTitle}>
                      {model.activeProject.title}
                    </Text>
                    <Text style={styles.activeProjectMeta}>
                      {t('home.project.summary', {
                        files: model.activeProjectFiles.length,
                        messages: model.activeProject.messages.length,
                      })}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.projectContentGrid,
                      stackProjectPanels
                        ? styles.projectContentGridCompact
                        : null,
                    ]}
                  >
                    <View style={styles.subsection}>
                      <Text style={styles.subsectionTitle}>
                        {t('home.project.textTitle')}
                      </Text>
                      {model.activeProject.messages.length === 0 ? (
                        <EmptyState title={t('home.project.textEmpty')} />
                      ) : (
                        model.activeProject.messages.map(message => (
                          <MessageCard
                            key={message.id}
                            locale={model.locale}
                            message={message}
                            onCopy={() => {
                              model.copyMessage(message);
                            }}
                            onDelete={() => {
                              void model.deleteMessage(
                                model.activeProject!.id,
                                message.id,
                              );
                            }}
                            t={t}
                          />
                        ))
                      )}
                    </View>

                    <View style={styles.subsection}>
                      <Text style={styles.subsectionTitle}>
                        {t('home.project.filesTitle')}
                      </Text>
                      {model.activeProjectFiles.length === 0 ? (
                        <EmptyState title={t('home.project.filesEmpty')} />
                      ) : (
                        model.activeProjectFiles.map(file => (
                          <FileCard
                            busy={
                              isBusy &&
                              (model.busyAction === 'share' ||
                                model.busyAction === 'file' ||
                                model.busyAction === `export:${file.id}`)
                            }
                            compact={isCompactScreen}
                            file={file}
                            isShared={model.isFileShared(file.id)}
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
                        ))
                      )}
                    </View>
                  </View>
                </>
              ) : (
                <EmptyState title={t('home.project.empty')} />
              )}
            </PanelSurface>
          </GuidedTourTarget>
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

type InfoBadgeProps = {
  compact?: boolean;
  icon: React.ReactNode;
  label: string;
  testID?: string;
  value: string;
  valueColor?: string;
};

function InfoBadge({
  compact,
  icon,
  label,
  testID,
  value,
  valueColor,
}: InfoBadgeProps) {
  return (
    <View
      style={[styles.infoBadge, compact ? styles.infoBadgeCompact : null]}
      testID={testID}
    >
      <View
        style={[
          styles.infoBadgeIconWrap,
          compact ? styles.infoBadgeIconWrapCompact : null,
        ]}
      >
        {icon}
      </View>
      <View
        style={[
          styles.infoBadgeText,
          compact ? styles.infoBadgeTextCompact : null,
        ]}
      >
        <Text
          style={[
            styles.infoBadgeLabel,
            compact ? styles.infoBadgeLabelCompact : null,
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.infoBadgeValue,
            compact ? styles.infoBadgeValueCompact : null,
            valueColor ? { color: valueColor } : null,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

type KeyValueTileProps = {
  fill?: boolean;
  label: string;
  value: string;
};

function KeyValueTile({ fill, label, value }: KeyValueTileProps) {
  return (
    <View style={[styles.keyValueTile, fill ? styles.keyValueTileFill : null]}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text selectable style={styles.keyValue}>
        {value}
      </Text>
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
  testID?: string;
};

function PrimaryButton({
  accessibilityLabel,
  compact,
  disabled,
  fullWidth,
  label,
  onPress,
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
      testID={testID}
      tone="danger"
    />
  );
}

type IconButtonProps = Omit<ButtonProps, 'fullWidth' | 'label'> & {
  icon: string;
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
      glyph={icon}
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
      glyph="⋯"
      onPress={onPress}
      testID={testID}
    />
  );
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

type MessageCardProps = {
  locale: string;
  message: TextMessage;
  onCopy: () => void;
  onDelete: () => void;
  t: TranslateApp;
};

function MessageCard({
  locale,
  message,
  onCopy,
  onDelete,
  t,
}: MessageCardProps) {
  return (
    <PanelSurface style={styles.messageCard}>
      <Text style={styles.messageBody}>{message.content}</Text>
      <Text style={styles.messageMeta}>
        {formatDateTime(message.createdAt, locale)} ·{' '}
        {message.source === 'browser'
          ? t('message.source.browser')
          : t('message.source.app')}
      </Text>
      <View style={styles.inlineActions}>
        <GhostButton label={t('common.copy')} onPress={onCopy} />
        <DangerGhostButton label={t('common.delete')} onPress={onDelete} />
      </View>
    </PanelSurface>
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
  onToggleShare: () => void;
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
  onToggleShare,
  t,
}: FileCardProps) {
  return (
    <PanelSurface style={styles.fileCard}>
      <View
        style={[
          styles.fileCardHeader,
          compact ? styles.fileCardHeaderCompact : null,
        ]}
      >
        <View style={styles.fileCardHeaderMain}>
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <Text style={styles.fileMeta}>{formatBytes(file.size)}</Text>
          <Text
            style={styles.fileReceivedAt}
            testID={`file-received-at-${file.id}`}
          >
            {t('file.receivedAt', {
              date: formatDateTime(file.createdAt, locale),
            })}
          </Text>
          <Text numberOfLines={2} style={styles.filePath}>
            {file.relativePath}
          </Text>
        </View>
        <Text style={[styles.fileTag, isShared ? styles.fileTagShared : null]}>
          {isShared ? t('file.shared') : t('file.notShared')}
        </Text>
      </View>
      <View
        style={[
          styles.fileCardActionsRow,
          compact ? styles.fileCardActionsRowCompact : null,
        ]}
      >
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label={isShared ? t('file.removeFromShare') : t('file.addToShare')}
            onPress={onToggleShare}
          />
        </View>
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label={t('common.export')}
            onPress={onExport}
          />
        </View>
        <View style={styles.fileCardActionCell}>
          <DangerGhostButton
            compact
            disabled={busy}
            fullWidth
            label={t('common.delete')}
            onPress={onDelete}
          />
        </View>
      </View>
    </PanelSurface>
  );
}

type SharedListCardProps = {
  busy?: boolean;
  compact?: boolean;
  file: SharedFileRecord;
  locale: string;
  onExport: () => void;
  onRemoveShare: () => void;
  projectTitle: string;
  t: TranslateApp;
};

function SharedListCard({
  busy,
  compact,
  file,
  locale,
  onExport,
  onRemoveShare,
  projectTitle,
  t,
}: SharedListCardProps) {
  return (
    <PanelSurface style={styles.fileCard}>
      <View
        style={[
          styles.fileCardHeader,
          compact ? styles.fileCardHeaderCompact : null,
        ]}
      >
        <View style={styles.fileCardHeaderMain}>
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <Text numberOfLines={2} style={styles.fileMeta}>
            {formatBytes(file.size)} - {projectTitle}
          </Text>
          <Text
            style={styles.fileReceivedAt}
            testID={`shared-file-received-at-${file.id}`}
          >
            {formatDateTime(file.createdAt, locale)}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.fileCardActionsRow,
          compact ? styles.fileCardActionsRowCompact : null,
        ]}
      >
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label={t('common.export')}
            onPress={onExport}
          />
        </View>
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label={t('common.remove')}
            onPress={onRemoveShare}
          />
        </View>
      </View>
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

  return date.toLocaleString(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
