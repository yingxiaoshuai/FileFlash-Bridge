import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {theme} from './src/app/theme';
import {useAppModel} from './src/app/useAppModel';
import {
  ProjectRecord,
  SharedFileRecord,
  TextMessage,
} from './src/modules/service/models';

function App(): React.JSX.Element {
  const model = useAppModel();
  const isBusy = Boolean(model.busyAction);
  const {width} = useWindowDimensions();
  const isServiceRunning = model.serviceState.phase === 'running';
  const isPhoneLayout = width < 760;
  const isSidebarCompact = width < 640;
  const stackOverviewCards = width < 1180;
  const stackProjectPanels = width < 1020;
  const qrSize = width < 480 ? 118 : 156;
  const pagePadding = width < 480 ? 12 : 16;

  // Keep project history visible on the left, but avoid wasting the full left column on long mobile pages.
  const sidebarWidth = isPhoneLayout
    ? width < 420
      ? 138
      : 152
    : width < 980
      ? 240
      : 296;

  const projectTitleById = React.useMemo(
    () => new Map(model.projects.map(project => [project.id, project.title])),
    [model.projects],
  );

  const handleCopyLink = () => {
    if (!model.serviceState.accessUrl) {
      Alert.alert('没有可复制的地址', '请先启动服务。');
      return;
    }

    Clipboard.setString(model.serviceState.accessUrl);
    Alert.alert('已复制', '链接已复制到剪贴板。');
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

  const sidebarContent = (
    <>
      <View style={styles.sidebarCard}>
        <Text style={styles.sidebarEyebrow}>FileFlash Bridge</Text>
        <Text
          numberOfLines={1}
          style={[
            styles.sidebarTitle,
            isSidebarCompact ? styles.sidebarTitleCompact : null,
          ]}>
          项目
        </Text>
        <StatusChip
          accent={isServiceRunning ? theme.colors.success : theme.colors.inkSoft}
          label={isServiceRunning ? '服务在线' : '服务离线'}
        />
        <View
          style={[
            styles.sidebarMetrics,
            isSidebarCompact ? styles.sidebarMetricsCompact : null,
          ]}>
          <SidebarMetric label="项目" value={String(model.projects.length)} />
          <SidebarMetric label="共享" value={String(model.sharedFiles.length)} />
        </View>
      </View>

      <View style={styles.sidebarListCard}>
        <Text style={styles.sidebarSectionTitle}>项目历史</Text>
        {model.projects.length === 0 ? (
          <EmptyState title="还没有项目" />
        ) : (
          <View style={styles.projectSidebarList}>
            {model.projects.map(project => (
              <ProjectPill
                active={project.id === model.activeProject?.id}
                compact={isSidebarCompact}
                key={project.id}
                onPress={() => {
                  void model.selectProject(project.id);
                }}
                project={project}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.sidebarActions}>
        <PrimaryButton
          disabled={isBusy}
          label={isServiceRunning ? '停止服务' : '启动服务'}
          onPress={() => {
            void model.toggleService();
          }}
        />
        <GhostButton
          disabled={isBusy}
          label="新建项目"
          onPress={() => {
            void model.createProject();
          }}
        />
        <GhostButton
          disabled={isBusy}
          label="选文件"
          onPress={() => {
            void model.importFilesForShare();
          }}
        />
      </View>
    </>
  );

  const summaryContent = (
    <>
      <View style={[styles.header, isPhoneLayout ? styles.headerCompact : null]}>
        <View style={styles.headerMain}>
          <Text
            style={[
              styles.headerTitle,
              isPhoneLayout ? styles.headerTitleCompact : null,
            ]}>
            工作台
          </Text>
          <Text numberOfLines={1} style={styles.headerMeta}>
            {model.activeProject?.title ?? '未选择项目'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <GhostButton
            disabled={isBusy}
            label="复制链接"
            onPress={handleCopyLink}
          />
          <GhostButton
            disabled={isBusy}
            label="刷新地址"
            onPress={() => {
              void model.refreshAddress();
            }}
          />
        </View>
      </View>

      {model.notice ? (
        <NoticeBanner
          message={model.notice.message}
          onDismiss={model.clearNotice}
          tone={model.notice.tone}
        />
      ) : null}

      <View style={styles.metricRow}>
        <InfoBadge
          tone={isServiceRunning ? 'success' : 'neutral'}
          label="服务"
          value={isServiceRunning ? '在线' : '离线'}
        />
        <InfoBadge
          label="连接"
          value={String(model.serviceState.activeConnections.length)}
        />
        <InfoBadge
          label="共享"
          value={String(model.sharedFiles.length)}
        />
        <InfoBadge
          label="模式"
          value={
            model.serviceState.config.securityMode === 'secure'
              ? '安全'
              : '简单'
          }
        />
      </View>

      <View style={styles.quickToolsCard}>
        <Text style={styles.quickToolsTitle}>访问模式</Text>
        <View style={styles.modeRow}>
          <ModePill
            active={model.serviceState.config.securityMode === 'simple'}
            label="简单模式"
            onPress={() => {
              void model.setSecurityMode('simple');
            }}
          />
          <ModePill
            active={model.serviceState.config.securityMode === 'secure'}
            label="安全模式"
            onPress={() => {
              void model.setSecurityMode('secure');
            }}
          />
        </View>
        <View style={styles.inlineActions}>
          <GhostButton
            disabled={isBusy}
            label="刷新 key"
            onPress={() => {
              void model.rotateKey();
            }}
          />
        </View>
      </View>
    </>
  );

  const detailContent = (
    <>
      <View
        style={[
          styles.topGrid,
          stackOverviewCards ? styles.topGridCompact : null,
        ]}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionTitle title="服务" />
            <StatusChip
              accent={
                isServiceRunning ? theme.colors.success : theme.colors.inkSoft
              }
              label={isServiceRunning ? '在线' : '离线'}
            />
          </View>

          <View
            style={[
              styles.serviceSummaryGrid,
              isSidebarCompact ? styles.serviceSummaryGridCompact : null,
            ]}>
            <KeyValueTile
              label="地址"
              value={model.serviceState.accessUrl ?? '未启动'}
            />
            <KeyValueTile
              label="网络"
              value={model.serviceState.network.label}
            />
          </View>

          {model.serviceState.qrValue ? (
            <View style={styles.qrPanel}>
              <QRCode
                backgroundColor={theme.colors.surface}
                color={theme.colors.ink}
                size={qrSize}
                value={model.serviceState.qrValue}
              />
            </View>
          ) : (
            <EmptyState title="服务未启动" />
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionTitle title="共享文件" />
            <GhostButton
              disabled={isBusy}
              label="选文件"
              onPress={() => {
                void model.importFilesForShare();
              }}
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
                file={file}
                key={`shared-${file.id}`}
                onExport={() => {
                  void model.exportFile(file);
                }}
                onOpenProject={() => {
                  void model.selectProject(file.projectId);
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
        </View>
      </View>

      <View style={styles.card}>
        {model.activeProject ? (
          <>
            <View
              style={[
                styles.activeProjectHeader,
                isPhoneLayout ? styles.activeProjectHeaderCompact : null,
              ]}>
              <View style={styles.activeProjectHeaderMain}>
                <Text style={styles.activeProjectTitle}>
                  {model.activeProject.title}
                </Text>
                <Text style={styles.activeProjectMeta}>
                  {model.activeProject.messages.length} 条消息 ·{' '}
                  {model.activeProjectFiles.length} 个文件
                </Text>
              </View>
              <DangerGhostButton
                disabled={isBusy}
                label="删除项目"
                onPress={() => {
                  confirmDeleteProject(model.activeProject!);
                }}
              />
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
      </View>
    </>
  );

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
      />
      <SafeAreaView style={styles.safeArea}>
        {!model.isReady ? (
          <View style={styles.loadingShell}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text style={styles.loadingTitle}>正在加载</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.page, {padding: pagePadding}]}
            showsVerticalScrollIndicator={false}>
            {isPhoneLayout ? (
              <View style={styles.phoneLayout}>
                <View style={styles.phoneTopRow}>
                  <View style={[styles.sidebar, {width: sidebarWidth}]}>
                    {sidebarContent}
                  </View>
                  <View style={styles.phoneSummary}>{summaryContent}</View>
                </View>
                <View style={styles.phoneMain}>{detailContent}</View>
              </View>
            ) : (
              <View style={styles.workspace}>
                <View style={[styles.sidebar, {width: sidebarWidth}]}>
                  {sidebarContent}
                </View>
                <View style={styles.main}>
                  {summaryContent}
                  {detailContent}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type SectionTitleProps = {
  title: string;
};

function SectionTitle({title}: SectionTitleProps) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
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

type SidebarMetricProps = {
  label: string;
  value: string;
};

function SidebarMetric({label, value}: SidebarMetricProps) {
  return (
    <View style={styles.sidebarMetric}>
      <Text style={styles.sidebarMetricValue}>{value}</Text>
      <Text style={styles.sidebarMetricLabel}>{label}</Text>
    </View>
  );
}

type InfoBadgeProps = {
  label: string;
  tone?: 'neutral' | 'success';
  value: string;
};

function InfoBadge({label, tone = 'neutral', value}: InfoBadgeProps) {
  return (
    <View
      style={[
        styles.infoBadge,
        tone === 'success' ? styles.infoBadgeSuccess : null,
      ]}>
      <Text style={styles.infoBadgeLabel}>{label}</Text>
      <Text style={styles.infoBadgeValue}>{value}</Text>
    </View>
  );
}

type KeyValueTileProps = {
  label: string;
  value: string;
};

function KeyValueTile({label, value}: KeyValueTileProps) {
  return (
    <View style={styles.keyValueTile}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value}</Text>
    </View>
  );
}

type ButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function PrimaryButton({disabled, label, onPress}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled ? styles.buttonDisabled : null]}>
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({disabled, label, onPress}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.ghostButton, disabled ? styles.buttonDisabled : null]}>
      <Text style={styles.ghostButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function DangerGhostButton({disabled, label, onPress}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.dangerGhostButton,
        disabled ? styles.buttonDisabled : null,
      ]}>
      <Text style={styles.dangerGhostButtonLabel}>{label}</Text>
    </Pressable>
  );
}

type ModePillProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function ModePill({active, label, onPress}: ModePillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modePill, active ? styles.modePillActive : null]}>
      <Text
        style={[
          styles.modePillLabel,
          active ? styles.modePillLabelActive : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ProjectPillProps = {
  active: boolean;
  compact?: boolean;
  onPress: () => void;
  project: ProjectRecord;
};

function ProjectPill({active, compact, onPress, project}: ProjectPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.projectPill, active ? styles.projectPillActive : null]}>
      <Text
        numberOfLines={compact ? 2 : 1}
        style={[
          styles.projectTitle,
          compact ? styles.projectTitleCompact : null,
          active ? styles.projectTitleActive : null,
        ]}>
        {project.title}
      </Text>
      <Text
        numberOfLines={2}
        style={[
          styles.projectMeta,
          compact ? styles.projectMetaCompact : null,
          active ? styles.projectMetaActive : null,
        ]}>
        {project.messages.length} 条消息 · {project.fileIds.length} 个文件
      </Text>
    </Pressable>
  );
}

type MessageCardProps = {
  message: TextMessage;
  onCopy: () => void;
  onDelete: () => void;
};

function MessageCard({message, onCopy, onDelete}: MessageCardProps) {
  return (
    <View style={styles.messageCard}>
      <Text style={styles.messageBody}>{message.content}</Text>
      <Text style={styles.messageMeta}>
        {formatDateTime(message.createdAt)} ·{' '}
        {message.source === 'browser' ? '浏览器' : 'App'}
      </Text>
      <View style={styles.inlineActions}>
        <GhostButton label="复制" onPress={onCopy} />
        <GhostButton label="删除" onPress={onDelete} />
      </View>
    </View>
  );
}

type FileCardProps = {
  busy?: boolean;
  file: SharedFileRecord;
  isShared: boolean;
  onDelete: () => void;
  onExport: () => void;
  onToggleShare: () => void;
};

function FileCard({
  busy,
  file,
  isShared,
  onDelete,
  onExport,
  onToggleShare,
}: FileCardProps) {
  return (
    <View style={styles.fileCard}>
      <View style={styles.fileCardHeader}>
        <View style={styles.fileCardHeaderMain}>
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <Text style={styles.fileMeta}>{formatBytes(file.size)}</Text>
          <Text numberOfLines={2} style={styles.filePath}>
            {file.relativePath}
          </Text>
        </View>
        <Text style={[styles.fileTag, isShared ? styles.fileTagShared : null]}>
          {isShared ? '已共享' : '未共享'}
        </Text>
      </View>
      <View style={styles.inlineActions}>
        <GhostButton
          disabled={busy}
          label={isShared ? '移出共享' : '加入共享'}
          onPress={onToggleShare}
        />
        <GhostButton disabled={busy} label="导出" onPress={onExport} />
        <DangerGhostButton disabled={busy} label="删除" onPress={onDelete} />
      </View>
    </View>
  );
}

type SharedListCardProps = {
  busy?: boolean;
  file: SharedFileRecord;
  onExport: () => void;
  onOpenProject: () => void;
  onRemoveShare: () => void;
  projectTitle: string;
};

function SharedListCard({
  busy,
  file,
  onExport,
  onOpenProject,
  onRemoveShare,
  projectTitle,
}: SharedListCardProps) {
  return (
    <View style={styles.fileCard}>
      <View style={styles.fileCardHeader}>
        <View style={styles.fileCardHeaderMain}>
          <Text numberOfLines={2} style={styles.fileName}>
            {file.displayName}
          </Text>
          <Text numberOfLines={2} style={styles.fileMeta}>
            {formatBytes(file.size)} · {projectTitle}
          </Text>
        </View>
      </View>
      <View style={styles.inlineActions}>
        <GhostButton disabled={busy} label="项目" onPress={onOpenProject} />
        <GhostButton disabled={busy} label="导出" onPress={onExport} />
        <GhostButton disabled={busy} label="移出" onPress={onRemoveShare} />
      </View>
    </View>
  );
}

type EmptyStateProps = {
  title: string;
};

function EmptyState({title}: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
    </View>
  );
}

type NoticeBannerProps = {
  message: string;
  onDismiss: () => void;
  tone: 'info' | 'success' | 'error';
};

function NoticeBanner({message, onDismiss, tone}: NoticeBannerProps) {
  return (
    <View
      style={[
        styles.noticeBanner,
        tone === 'success'
          ? styles.noticeBannerSuccess
          : tone === 'error'
            ? styles.noticeBannerError
            : styles.noticeBannerInfo,
      ]}>
      <Text style={styles.noticeMessage}>{message}</Text>
      <Pressable onPress={onDismiss} style={styles.noticeDismiss}>
        <Text style={styles.noticeDismissLabel}>关闭</Text>
      </Pressable>
    </View>
  );
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    paddingBottom: 24,
  },
  workspace: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
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
  sidebar: {
    gap: 12,
  },
  sidebarCard: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  sidebarEyebrow: {
    color: theme.colors.surfaceTint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sidebarTitle: {
    color: theme.colors.inkOnStrong,
    fontSize: 30,
    fontWeight: '800',
  },
  sidebarTitleCompact: {
    fontSize: 24,
  },
  sidebarMetrics: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sidebarMetricsCompact: {
    flexDirection: 'column',
  },
  sidebarMetric: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  sidebarMetricValue: {
    color: theme.colors.inkOnStrong,
    fontSize: 18,
    fontWeight: '800',
  },
  sidebarMetricLabel: {
    color: theme.colors.inkOnStrongSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  sidebarListCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sidebarSectionTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  sidebarActions: {
    gap: 10,
  },
  projectSidebarList: {
    gap: 10,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCompact: {
    flexDirection: 'column',
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: theme.colors.ink,
    fontSize: 30,
    fontWeight: '800',
  },
  headerTitleCompact: {
    fontSize: 26,
  },
  headerMeta: {
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoBadge: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    gap: 2,
  },
  infoBadgeSuccess: {
    backgroundColor: '#E2F2E8',
    borderColor: '#B9D9C4',
  },
  infoBadgeLabel: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  infoBadgeValue: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  quickToolsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 12,
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
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: '#E2F2E8',
  },
  noticeBannerError: {
    backgroundColor: '#FBE3D8',
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.colors.surfaceMuted,
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
  serviceSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceSummaryGridCompact: {
    flexDirection: 'column',
  },
  keyValueTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
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
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  modePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceMuted,
  },
  modePillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modePillLabel: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  modePillLabelActive: {
    color: theme.colors.inkOnStrong,
  },
  qrPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
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
  activeProjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  activeProjectHeaderCompact: {
    flexDirection: 'column',
  },
  activeProjectHeaderMain: {
    flex: 1,
    gap: 4,
  },
  activeProjectTitle: {
    color: theme.colors.ink,
    fontSize: 22,
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
    flexDirection: 'column',
  },
  subsection: {
    flex: 1,
    gap: 10,
  },
  subsectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  messageCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 18,
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
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 18,
    gap: 12,
    padding: 16,
  },
  fileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fileCardHeaderMain: {
    flex: 1,
    gap: 4,
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
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
  },
  fileTagShared: {
    color: theme.colors.primary,
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
  dangerGhostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2A786',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFF2EB',
  },
  dangerGhostButtonLabel: {
    color: '#A44D19',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});

export default App;
