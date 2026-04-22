import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {Drawer, Menu, PaperProvider} from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {paperTheme} from './src/app/paperTheme';
import {theme} from './src/app/theme';
import {
  ActionButton,
  EmptyStateCard,
  GlyphIconButton,
  InlineMeta,
  PanelSurface,
} from './src/app/ui';
import {useAppModel} from './src/app/useAppModel';
import {
  ProjectRecord,
  SharedFileRecord,
  TextMessage,
} from './src/modules/service/models';

function AppScreen(): React.JSX.Element {
  const model = useAppModel();
  const isBusy = Boolean(model.busyAction);
  const [isProjectHistoryOpen, setProjectHistoryOpen] = React.useState(false);
  const [projectActionMenuId, setProjectActionMenuId] = React.useState<
    string | undefined
  >();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isServiceRunning = model.serviceState.phase === 'running';
  const isCompactScreen = width < 560;
  const stackOverviewCards = width < 1180;
  const stackProjectPanels = width < 1020;
  const qrSize = width < 480 ? 118 : 156;
  const pagePadding = width < 480 ? 12 : 16;
  const serviceCardContentMax = stackOverviewCards
    ? width - pagePadding * 2 - 36
    : Math.max(160, Math.floor((width - pagePadding * 2 - 14) / 2) - 36);
  const serviceQrSize = Math.min(qrSize, Math.max(112, serviceCardContentMax));
  const historyDrawerWidth =
    width < 560
      ? Math.min(Math.max(280, Math.floor(width * 0.82)), 340)
      : Math.min(Math.max(304, Math.floor(width * 0.32)), 380);
  const securityModeLabel =
    model.serviceState.config.securityMode === 'secure' ? '安全模式' : '简单模式';
  const hasReachableAddress =
    Boolean(model.serviceState.accessUrl) && model.serviceState.network.reachable;
  const stoppedAddressCopy = model.serviceState.network.reachable
    ? '启动后显示浏览器入口'
    : model.serviceState.error?.message ?? model.serviceState.network.label;

  const projectTitleById = React.useMemo(
    () => new Map(model.projects.map(project => [project.id, project.title])),
    [model.projects],
  );

  const previousActiveProjectIdRef = React.useRef<string | undefined>(
    model.activeProject?.id,
  );

  React.useEffect(() => {
    if (
      projectActionMenuId &&
      !model.projects.some(project => project.id === projectActionMenuId)
    ) {
      setProjectActionMenuId(undefined);
    }
  }, [model.projects, projectActionMenuId]);

  React.useEffect(() => {
    const previousActiveProjectId = previousActiveProjectIdRef.current;
    if (
      isProjectHistoryOpen &&
      previousActiveProjectId &&
      previousActiveProjectId !== model.activeProject?.id
    ) {
      setProjectHistoryOpen(false);
    }

    previousActiveProjectIdRef.current = model.activeProject?.id;
  }, [isProjectHistoryOpen, model.activeProject?.id]);

  const handleCopyLink = () => {
    if (!model.serviceState.accessUrl) {
      Alert.alert('没有可复制的地址', '请先启动服务。');
      return;
    }

    Clipboard.setString(model.serviceState.accessUrl);
    Alert.alert('已复制', '链接已复制到剪贴板。');
  };

  const handleRefreshAddress = () => {
    void model.refreshAddress();
  };

  const handleShowSecurityModeHelp = () => {
    Alert.alert(
      '安全模式',
      '开启后链接与二维码携带访问密钥；关闭为简单模式。',
    );
  };

  const handleShowNetworkHelp = () => {
    const message = model.serviceState.network.reachable
      ? `当前网络：${model.serviceState.network.label}`
      : [
          model.serviceState.error?.message ??
            '没有探测到可被其他设备访问的地址，请检查当前 Wi-Fi 或热点连接。',
          model.serviceState.error?.suggestedAction,
        ]
          .filter(Boolean)
          .join('；');

    Alert.alert('网络状态', message);
  };

  const confirmDeleteProject = (project: ProjectRecord) => {
    Alert.alert('删除项目', model.deletionWarning, [
      {
        style: 'cancel',
        text: '取消',
      },
      {
        onPress: () => {
          void model.deleteProject(project.id);
        },
        style: 'destructive',
        text: '删除',
      },
    ]);
  };

  const sidebarContent = () => (
    <PanelSurface style={styles.sidebarPanel}>
      <View style={styles.sidebarListCard}>
        <View style={styles.sidebarHeaderRow}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarSectionTitle}>项目历史</Text>
            <Text style={styles.sidebarSectionMeta}>
              {model.projects.length} 个项目
            </Text>
          </View>
          <GhostButton
            disabled={isBusy}
            label="新建"
            onPress={() => {
              void model.createProject();
            }}
            testID="sidebar-create-project"
          />
        </View>
        {model.projects.length === 0 ? (
          <EmptyState title="还没有项目" />
        ) : (
          <Drawer.Section style={styles.projectDrawerSection}>
            {model.projects.map(project => (
              <ProjectHistoryRow
                active={project.id === model.activeProject?.id}
                key={project.id}
                lastItem={project.id === model.projects[model.projects.length - 1]?.id}
                menuVisible={projectActionMenuId === project.id}
                onDelete={() => {
                  setProjectActionMenuId(undefined);
                  confirmDeleteProject(project);
                }}
                onDismissMenu={() => {
                  setProjectActionMenuId(undefined);
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
              />
            ))}
          </Drawer.Section>
        )}
      </View>
    </PanelSurface>
  );

  const summaryContent = (
    <PanelSurface style={styles.summaryShell}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text
            style={[
              styles.headerTitle,
              isCompactScreen ? styles.headerTitleCompact : null,
            ]}>
            工作台
          </Text>
          <Text numberOfLines={1} style={styles.headerMeta}>
            {model.activeProject?.title ?? '未选择项目'}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <InfoBadge
          icon="◌"
          label="连接"
          testID="workspace-summary-connections"
          value={String(model.serviceState.activeConnections.length)}
        />
        <InfoBadge
          icon="↗"
          label="共享"
          testID="workspace-summary-shared"
          value={String(model.sharedFiles.length)}
        />
        <InfoBadge
          icon={model.serviceState.config.securityMode === 'secure' ? '◉' : '◎'}
          label="模式"
          testID="workspace-summary-mode"
          value={
            model.serviceState.config.securityMode === 'secure'
              ? '安全'
              : '简单'
          }
        />
      </View>
    </PanelSurface>
  );

  const detailContent = (
    <>
      <View
        style={[
          styles.topGrid,
          stackOverviewCards ? styles.topGridCompact : null,
        ]}>
        <PanelSurface
          style={[styles.card, styles.topGridPanel, styles.serviceCard]}>
          <View style={styles.serviceHeaderRow}>
            <View style={styles.serviceHeaderTitleWrap}>
              <SectionTitle title="服务" />
            </View>
            <NetworkTag
              reachable={model.serviceState.network.reachable}
              text={model.serviceState.network.label}
            />
          </View>

          {hasReachableAddress ? (
            <View style={styles.serviceAddressSection} testID="service-address-row">
              <KeyValueTile
                fill
                label="地址"
                value={model.serviceState.accessUrl!}
              />
              <View style={styles.serviceAddressActions}>
                <IconButton
                  accessibilityLabel="复制链接"
                  disabled={isBusy}
                  icon="⎘"
                  onPress={handleCopyLink}
                  testID="service-copy-link"
                />
                <IconButton
                  accessibilityLabel="刷新地址"
                  disabled={isBusy}
                  icon="↻"
                  onPress={handleRefreshAddress}
                  testID="service-refresh-address"
                />
              </View>
            </View>
          ) : (
            <View
              style={styles.serviceAddressCollapsed}
              testID="service-address-collapsed">
              <Text style={styles.serviceAddressCollapsedLabel}>地址</Text>
              <Text style={styles.serviceAddressCollapsedValue}>
                {stoppedAddressCopy}
              </Text>
            </View>
          )}

          <PrimaryButton
            disabled={isBusy}
            fullWidth
            label={isServiceRunning ? '停止服务' : '启动服务'}
            onPress={() => {
              void model.toggleService();
            }}
            testID="home-toggle-service"
          />

          <View style={styles.serviceSecondaryPanel}>
            <View style={styles.serviceSecondaryRow} testID="service-mode-panel">
              <View style={styles.securityModeSwitchText}>
                <View style={styles.securityModeTitleRow}>
                  <Text style={styles.quickToolsTitle}>访问模式</Text>
                  <GlyphIconButton
                    accessibilityLabel="查看安全模式说明"
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
                accessibilityLabel="安全模式"
                disabled={isBusy}
                ios_backgroundColor={theme.colors.border}
                onValueChange={nextSecure => {
                  void model.setSecurityMode(nextSecure ? 'secure' : 'simple');
                }}
                thumbColor={theme.colors.surfaceElevated}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                value={model.serviceState.config.securityMode === 'secure'}
              />
            </View>
            {!model.serviceState.network.reachable ? (
              <View
                style={styles.networkDiagnosisRow}
                testID="service-network-warning">
                <View style={styles.networkDiagnosisText}>
                  <Text style={styles.networkDiagnosisLabel}>网络状态</Text>
                  <Text style={styles.networkDiagnosisValue}>
                    {model.serviceState.network.label}
                  </Text>
                </View>
                <IconButton
                  accessibilityLabel="查看网络说明"
                  disabled={isBusy}
                  icon="!"
                  onPress={handleShowNetworkHelp}
                  testID="service-network-help"
                />
              </View>
            ) : null}
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

        <PanelSurface style={[styles.card, styles.topGridPanel, styles.sharedFilesCard]}>
          <View style={styles.cardHeaderRow}>
            <SectionTitle title="共享文件" />
            <GhostButton
              disabled={isBusy}
              compact
              label="选文件"
              onPress={() => {
                void model.importFilesForShare();
              }}
              testID="home-import-files"
            />
          </View>

          {model.sharedFiles.length === 0 ? (
            <EmptyState title="暂无共享文件" />
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
                onExport={() => {
                  void model.exportFile(file);
                }}
                onRemoveShare={() => {
                  void model.toggleSharedFile(file.id);
                }}
                projectTitle={
                  projectTitleById.get(file.projectId) ?? '未命名项目'
                }
              />
            ))
          )}
        </PanelSurface>
      </View>

      <PanelSurface style={styles.card}>
        {model.activeProject ? (
          <>
            <View style={styles.activeProjectHeaderMain}>
              <Text style={styles.activeProjectTitle}>
                {model.activeProject.title}
              </Text>
              <Text style={styles.activeProjectMeta}>
                {model.activeProject.messages.length} 条消息 ·{' '}
                {model.activeProjectFiles.length} 个文件
              </Text>
            </View>

            <View
              style={[
                styles.projectContentGrid,
                stackProjectPanels ? styles.projectContentGridCompact : null,
              ]}>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>文本</Text>
                {model.activeProject.messages.length === 0 ? (
                  <EmptyState title="暂无文本" />
                ) : (
                  model.activeProject.messages.map(message => (
                    <MessageCard
                      key={message.id}
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
                    />
                  ))
                )}
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>文件</Text>
                {model.activeProjectFiles.length === 0 ? (
                  <EmptyState title="暂无文件" />
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
                      onDelete={() => {
                        void model.deleteFile(file.id);
                      }}
                      onExport={() => {
                        void model.exportFile(file);
                      }}
                      onToggleShare={() => {
                        void model.toggleSharedFile(file.id);
                      }}
                    />
                  ))
                )}
              </View>
            </View>
          </>
        ) : (
          <EmptyState title="先创建一个项目" />
        )}
      </PanelSurface>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
      />
      <View pointerEvents="none" style={styles.backdropLayer}>
        <View style={[styles.backdropGlow, styles.backdropGlowPrimary]} />
        <View style={[styles.backdropGlow, styles.backdropGlowSecondary]} />
      </View>
      {!model.isReady ? (
        <View style={styles.loadingShell}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.loadingTitle}>正在加载</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.page, {padding: pagePadding}]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.globalTopBar, styles.globalTopBarStacked]}>
            <IconButton
              accessibilityLabel="打开项目历史"
              disabled={isBusy}
              icon="☰"
              onPress={() => {
                setProjectHistoryOpen(true);
              }}
              testID="sidebar-open"
            />
            <StatusChip
              accent={
                isServiceRunning ? theme.colors.success : theme.colors.inkSoft
              }
              label={isServiceRunning ? '服务在线' : '服务离线'}
            />
          </View>
          <View style={styles.main}>
            {summaryContent}
            {detailContent}
          </View>
        </ScrollView>
      )}
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
            testID="sidebar-panel">
            <ScrollView
              contentContainerStyle={styles.sidebarDrawerScrollContent}
              showsVerticalScrollIndicator={false}>
              {sidebarContent()}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AppScreen />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

type SectionTitleProps = {
  title: string;
};

function SectionTitle({title}: SectionTitleProps) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

type NetworkTagProps = {
  reachable?: boolean;
  text: string;
};

function NetworkTag({reachable = true, text}: NetworkTagProps) {
  return (
    <View
      style={[
        styles.networkTag,
        !reachable ? styles.networkTagWarning : null,
      ]}>
      <Text style={styles.networkTagLabel}>网络</Text>
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

function StatusChip({accent, label}: StatusChipProps) {
  return (
    <View style={[styles.statusChip, {borderColor: accent}]}>
      <View style={[styles.statusDot, {backgroundColor: accent}]} />
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

type InfoBadgeProps = {
  icon: string;
  label: string;
  tone?: 'neutral' | 'success';
  testID?: string;
  value: string;
};

function InfoBadge({
  icon,
  label,
  tone = 'neutral',
  testID,
  value,
}: InfoBadgeProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.infoBadge,
        tone === 'success' ? styles.infoBadgeSuccess : null,
      ]}>
      <Text style={styles.infoBadgeIcon}>{icon}</Text>
      <View style={styles.infoBadgeText}>
        <Text style={styles.infoBadgeLabel}>{label}</Text>
        <Text style={styles.infoBadgeValue}>{value}</Text>
      </View>
    </View>
  );
}

type KeyValueTileProps = {
  fill?: boolean;
  label: string;
  value: string;
};

function KeyValueTile({fill, label, value}: KeyValueTileProps) {
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
  icon?: string;
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
  onPress: () => void;
  testID?: string;
};

function MenuTriggerButton({onPress, testID}: MenuTriggerButtonProps) {
  return (
    <GlyphIconButton
      accessibilityLabel="打开项目操作"
      glyph="⋯"
      onPress={onPress}
      testID={testID}
    />
  );
}

type ProjectHistoryRowProps = {
  active: boolean;
  lastItem?: boolean;
  menuVisible: boolean;
  onDelete: () => void;
  onDismissMenu: () => void;
  onOpenMenu: () => void;
  onPress: () => void;
  project: ProjectRecord;
  statusBarHeight?: number;
};

function ProjectHistoryRow({
  active,
  lastItem,
  menuVisible,
  onDelete,
  onDismissMenu,
  onOpenMenu,
  onPress,
  project,
  statusBarHeight,
}: ProjectHistoryRowProps) {
  return (
    <View
      style={[
        styles.projectHistoryRow,
        active ? styles.projectHistoryRowActive : null,
        !lastItem ? styles.projectHistoryRowDivider : null,
      ]}>
      <Pressable
        onPress={onPress}
        style={styles.projectHistoryRowBody}
        testID={`project-drawer-item-${project.id}`}>
        <View style={styles.projectHistoryRowHeader}>
          <Text
            numberOfLines={1}
            style={[
              styles.projectHistoryRowTitle,
              active ? styles.projectHistoryRowTitleActive : null,
            ]}>
            {project.title}
          </Text>
          <Text style={styles.projectHistoryRowDate}>
            {formatDate(project.createdAt)}
          </Text>
        </View>
        <InlineMeta style={styles.projectHistoryRowMetaWrap}>
          <Text
            style={[
              styles.projectHistoryRowMeta,
              active ? styles.projectHistoryRowMetaActive : null,
            ]}>
            {project.fileIds.length} 个文件
          </Text>
          <Text
            style={[
              styles.projectHistoryRowMeta,
              active ? styles.projectHistoryRowMetaActive : null,
            ]}>
            {project.messages.length} 条消息
          </Text>
        </InlineMeta>
      </Pressable>
      <Menu
        anchor={
          <MenuTriggerButton
            onPress={onOpenMenu}
            testID={`project-row-menu-open-${project.id}`}
          />
        }
        anchorPosition="bottom"
        onDismiss={onDismissMenu}
        statusBarHeight={statusBarHeight}
        testID={`project-row-menu-${project.id}`}
        visible={menuVisible}>
        <Menu.Item
          onPress={onDelete}
          testID={`project-row-menu-delete-${project.id}`}
          title="删除项目"
          titleStyle={styles.projectHistoryMenuDeleteLabel}
        />
      </Menu>
    </View>
  );
}

type MessageCardProps = {
  message: TextMessage;
  onCopy: () => void;
  onDelete: () => void;
};

function MessageCard({message, onCopy, onDelete}: MessageCardProps) {
  return (
    <PanelSurface style={styles.messageCard}>
      <Text style={styles.messageBody}>{message.content}</Text>
      <Text style={styles.messageMeta}>
        {formatDateTime(message.createdAt)} ·{' '}
        {message.source === 'browser' ? '浏览器' : 'App'}
      </Text>
      <View style={styles.inlineActions}>
        <GhostButton label="复制" onPress={onCopy} />
        <DangerGhostButton label="删除" onPress={onDelete} />
      </View>
    </PanelSurface>
  );
}

type FileCardProps = {
  busy?: boolean;
  compact?: boolean;
  file: SharedFileRecord;
  isShared: boolean;
  onDelete: () => void;
  onExport: () => void;
  onToggleShare: () => void;
};

function FileCard({
  busy,
  compact,
  file,
  isShared,
  onDelete,
  onExport,
  onToggleShare,
}: FileCardProps) {
  return (
    <PanelSurface style={styles.fileCard}>
      <View
        style={[
          styles.fileCardHeader,
          compact ? styles.fileCardHeaderCompact : null,
        ]}>
        <View style={styles.fileCardHeaderMain}>
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <Text style={styles.fileMeta}>{formatBytes(file.size)}</Text>
          <Text style={styles.fileReceivedAt} testID={`file-received-at-${file.id}`}>
            鎺ユ敹浜?{formatDateTime(file.createdAt)}
          </Text>
          <Text numberOfLines={2} style={styles.filePath}>
            {file.relativePath}
          </Text>
        </View>
        <Text style={[styles.fileTag, isShared ? styles.fileTagShared : null]}>
          {isShared ? '已共享' : '未共享'}
        </Text>
      </View>
      <View
        style={[
          styles.fileCardActionsRow,
          compact ? styles.fileCardActionsRowCompact : null,
        ]}>
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label={isShared ? '移出共享' : '加入共享'}
            onPress={onToggleShare}
          />
        </View>
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label="导出"
            onPress={onExport}
          />
        </View>
        <View style={styles.fileCardActionCell}>
          <DangerGhostButton
            compact
            disabled={busy}
            fullWidth
            label="删除"
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
  onExport: () => void;
  onRemoveShare: () => void;
  projectTitle: string;
};

function SharedListCard({
  busy,
  compact,
  file,
  onExport,
  onRemoveShare,
  projectTitle,
}: SharedListCardProps) {
  return (
    <PanelSurface style={styles.fileCard}>
      <View
        style={[
          styles.fileCardHeader,
          compact ? styles.fileCardHeaderCompact : null,
        ]}>
        <View style={styles.fileCardHeaderMain}>
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <Text numberOfLines={2} style={styles.fileMeta}>
            {formatBytes(file.size)} · {projectTitle}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.fileCardActionsRow,
          compact ? styles.fileCardActionsRowCompact : null,
        ]}>
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label="导出"
            onPress={onExport}
          />
        </View>
        <View style={styles.fileCardActionCell}>
          <GhostButton
            compact
            disabled={busy}
            fullWidth
            label="移出"
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

function EmptyState({title}: EmptyStateProps) {
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    position: 'relative',
  },
  backdropLayer: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backdropGlow: {
    borderRadius: 999,
    position: 'absolute',
  },
  backdropGlowPrimary: {
    backgroundColor: theme.colors.primarySoft,
    height: 260,
    opacity: 0.9,
    right: -40,
    top: -36,
    width: 260,
  },
  backdropGlowSecondary: {
    backgroundColor: theme.colors.surfaceTint,
    bottom: 80,
    height: 220,
    left: -60,
    opacity: 0.75,
    width: 220,
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  page: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  globalTopBar: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
    minHeight: 36,
  },
  globalTopBarStacked: {
    justifyContent: 'space-between',
  },
  stackedWorkspace: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
  },
  sidebarStack: {
    gap: 12,
    width: '100%',
  },
  phoneLayout: {
    gap: 14,
  },
  phoneTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  phoneSummary: {
    flex: 1,
    minWidth: 0,
    gap: 14,
  },
  phoneMain: {
    gap: 14,
  },
  sidebarPanel: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sidebarListCard: {
    gap: 12,
  },
  sidebarHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  sidebarHeader: {
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  sidebarSectionTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sidebarSectionMeta: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  sidebarToolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: '100%',
  },
  projectDrawerSection: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  projectHistoryRow: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  projectHistoryRowActive: {
    backgroundColor: theme.colors.primarySoft,
    borderLeftColor: theme.colors.primaryStrong,
    borderLeftWidth: 3,
    paddingLeft: 10,
  },
  projectHistoryRowDivider: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  projectHistoryRowBody: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    paddingVertical: 4,
  },
  projectHistoryRowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  projectHistoryRowTitle: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 0,
  },
  projectHistoryRowTitleActive: {
    color: theme.colors.ink,
  },
  projectHistoryRowDate: {
    color: theme.colors.inkMuted,
    fontSize: 11,
    lineHeight: 18,
  },
  projectHistoryRowMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  projectHistoryRowMeta: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  projectHistoryRowMetaActive: {
    color: theme.colors.ink,
  },
  projectHistoryMenuDeleteLabel: {
    color: theme.colors.dangerStrong,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 16,
  },
  sidebarOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  sidebarBackdrop: {
    backgroundColor: theme.colors.backdrop,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sidebarDrawerPanel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRightWidth: 1,
    bottom: 0,
    left: 0,
    paddingTop: 12,
    position: 'absolute',
    top: 0,
  },
  sidebarDrawerScrollContent: {
    gap: 0,
    paddingBottom: 24,
  },
  summaryShell: {
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  headerTitle: {
    color: theme.colors.ink,
    fontSize: 32,
    fontWeight: '800',
  },
  headerTitleCompact: {
    fontSize: 28,
  },
  headerMeta: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    color: theme.colors.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '58%',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'right',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  infoBadgeSuccess: {
    backgroundColor: theme.colors.successSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoBadgeIcon: {
    color: theme.colors.primaryStrong,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  infoBadgeText: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  infoBadgeLabel: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  infoBadgeValue: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  quickToolsTitle: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  topGrid: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  topGridCompact: {
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.card,
    gap: 14,
    padding: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  noticeBanner: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeBannerInfo: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  noticeBannerSuccess: {
    backgroundColor: theme.colors.successSoft,
  },
  noticeBannerError: {
    backgroundColor: theme.colors.dangerSoft,
  },
  noticeMessage: {
    color: theme.colors.ink,
    flex: 1,
    lineHeight: 20,
  },
  noticeDismiss: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  noticeDismissLabel: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.colors.surfaceElevated,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  topGridPanel: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  serviceHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    width: '100%',
  },
  serviceHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  networkTag: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.colors.secondarySoft,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    maxWidth: '56%',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  networkTagWarning: {
    backgroundColor: theme.colors.warningSoft,
    borderColor: theme.colors.warning,
  },
  networkTagLabel: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  networkTagValue: {
    color: theme.colors.ink,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 0,
  },
  serviceAddressSection: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  serviceAddressActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  serviceAddressCollapsed: {
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  serviceAddressCollapsedLabel: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  serviceAddressCollapsedValue: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  keyValueTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  keyLabel: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  keyValue: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  keyValueTileFill: {
    alignSelf: 'stretch',
    flex: 1,
    width: 'auto',
  },
  securityModeSwitchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  securityModeSwitchText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  securityModeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 2,
  },
  securityModeSwitchTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  serviceCard: {
    overflow: 'hidden',
    zIndex: 2,
  },
  serviceSecondaryPanel: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  serviceSecondaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  networkDiagnosisRow: {
    alignItems: 'center',
    backgroundColor: theme.colors.warningSoft,
    borderColor: theme.colors.warning,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  networkDiagnosisText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  networkDiagnosisLabel: {
    color: theme.colors.warningStrong,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  networkDiagnosisValue: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  qrPanel: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
    padding: 16,
    width: '100%',
    zIndex: 3,
  },
  sharedFilesCard: {
    gap: 12,
  },
  projectPill: {
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  projectPillActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.secondary,
  },
  projectTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  projectTitleCompact: {
    fontSize: 14,
  },
  projectTitleActive: {
    color: theme.colors.ink,
  },
  projectMeta: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  projectMetaCompact: {
    fontSize: 11,
  },
  projectMetaActive: {
    color: theme.colors.ink,
  },
  activeProjectHeaderMain: {
    gap: 4,
  },
  activeProjectTitle: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  activeProjectMeta: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  projectContentGrid: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  projectContentGridCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  subsection: {
    alignSelf: 'stretch',
    flex: 1,
    gap: 10,
  },
  subsectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  messageCard: {
    gap: 10,
    padding: 16,
  },
  messageBody: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  messageMeta: {
    color: theme.colors.inkSoft,
    fontSize: 12,
  },
  fileCard: {
    gap: 12,
    padding: 16,
  },
  fileCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fileCardHeaderCompact: {
    flexDirection: 'column',
  },
  fileCardHeaderMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  fileName: {
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  fileMeta: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  fileReceivedAt: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  filePath: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  fileTag: {
    alignSelf: 'flex-start',
    color: theme.colors.inkSoft,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  fileTagShared: {
    color: theme.colors.primaryStrong,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    padding: 16,
  },
  emptyStateTitle: {
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fileCardActionsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  fileCardActionsRowCompact: {
    flexDirection: 'column',
  },
  fileCardActionCell: {
    flex: 1,
    minWidth: 0,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: theme.colors.inkOnStrong,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
  ghostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  ghostButtonLabel: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButtonGlyph: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: -2,
    textAlign: 'center',
  },
  menuTriggerButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  menuTriggerGlyph: {
    color: theme.colors.inkSoft,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 18,
    marginTop: -6,
    textAlign: 'center',
  },
  dangerGhostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.dangerSoft,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: theme.colors.dangerSoft,
  },
  dangerGhostButtonLabel: {
    color: theme.colors.dangerStrong,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});

export default App;
