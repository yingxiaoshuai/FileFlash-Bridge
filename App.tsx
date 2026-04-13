import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import {ProjectRecord, SharedFileRecord, TextMessage} from './src/modules/service/models';

function App(): React.JSX.Element {
  const model = useAppModel();
  const isBusy = Boolean(model.busyAction);
  const {width} = useWindowDimensions();
  const isCompactLayout = width < 860;
  const projectTitleById = React.useMemo(
    () => new Map(model.projects.map(project => [project.id, project.title])),
    [model.projects],
  );

  const handleCopyLink = () => {
    if (!model.serviceState.accessUrl) {
      Alert.alert('没有可复制的地址', '请先启动服务，再复制访问链接。');
      return;
    }

    Clipboard.setString(model.serviceState.accessUrl);
    Alert.alert('链接已复制', '当前链接已经同步最新 key 和二维码。');
  };

  const confirmDeleteProject = (project: ProjectRecord) => {
    Alert.alert('删除整个项目', model.deletionWarning, [
      {
        style: 'cancel',
        text: '取消',
      },
      {
        onPress: () => {
          void model.deleteProject(project.id);
        },
        style: 'destructive',
        text: '删除项目',
      },
    ]);
  };

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>FileFlash Bridge</Text>
              </View>
              <Text style={styles.heroHint}>React Native + TypeScript</Text>
            </View>
            <Text style={styles.heroTitle}>手机端会话工作台</Text>
            <Text style={styles.heroSubtitle}>
              浏览器上传的文件和文本会直接落到本机 App 会话。没有任何预置项目、
              预置消息或预置共享文件，打开看到的就是当前设备上的真实状态。
            </Text>
            <View style={styles.heroActions}>
              <PrimaryButton
                disabled={isBusy}
                label={
                  model.serviceState.phase === 'running' ? '停止服务' : '启动服务'
                }
                onPress={() => {
                  void model.toggleService();
                }}
              />
              <GhostButton
                disabled={isBusy}
                label="刷新地址"
                onPress={() => {
                  void model.refreshAddress();
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
                label="选择文件发送"
                onPress={() => {
                  void model.importFilesForShare();
                }}
              />
            </View>
          </View>

          {!model.isReady ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
              <Text style={styles.loadingTitle}>正在加载本机会话</Text>
              <Text style={styles.loadingBody}>
                首次进入时会创建一个空项目；如果设备上已有历史会话，这里会直接恢复真实内容。
              </Text>
            </View>
          ) : (
            <>
              {model.notice ? (
                <NoticeBanner
                  message={model.notice.message}
                  tone={model.notice.tone}
                  onDismiss={model.clearNotice}
                />
              ) : null}

              <View style={styles.grid}>
                <View style={styles.card}>
                  <SectionTitle
                    title="Service"
                    description="地址、连接数和网络模式都来自当前设备状态，不使用任何预置样例。"
                  />
                  <StatusChip
                    accent={resolvePhaseColor(model.serviceState.phase)}
                    label={resolvePhaseLabel(model.serviceState.phase)}
                  />
                  <KeyValueRow
                    label="网络模式"
                    value={model.serviceState.network.label}
                  />
                  <KeyValueRow
                    label="访问地址"
                    value={model.serviceState.accessUrl ?? '服务未启动'}
                  />
                  <KeyValueRow
                    label="活跃连接"
                    value={String(model.serviceState.activeConnections.length)}
                  />
                  <KeyValueRow
                    label="共享文件数"
                    value={String(model.sharedFiles.length)}
                  />
                  <KeyValueRow
                    label="后台策略"
                    value={
                      Platform.OS === 'android'
                        ? '前台服务通知保活'
                        : '原生后台任务 + 自动恢复'
                    }
                  />
                  {model.serviceState.error ? (
                    <InlineNotice
                      label="恢复入口"
                      message={model.serviceState.error.message}
                    />
                  ) : null}
                </View>

                <View style={styles.card}>
                  <SectionTitle
                    title="Security"
                    description="简单模式只暴露 URL，安全模式会把 key 同步到链接和二维码。"
                  />
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
                  <KeyValueRow
                    label="当前 key"
                    value={
                      model.serviceState.config.securityMode === 'secure'
                        ? model.serviceState.config.accessKey
                        : '简单模式不需要 key'
                    }
                  />
                  <KeyValueRow
                    label="访问链接"
                    value={model.serviceState.accessUrl ?? '服务未启动'}
                  />
                  <Text style={styles.helperText}>{model.securityCopy}</Text>
                  <View style={styles.heroActions}>
                    <GhostButton
                      disabled={isBusy}
                      label="复制链接"
                      onPress={handleCopyLink}
                    />
                    <GhostButton
                      disabled={isBusy}
                      label="刷新 key"
                      onPress={() => {
                        void model.rotateKey();
                      }}
                    />
                  </View>
                  {model.serviceState.qrValue ? (
                    <View style={styles.qrPanel}>
                      <QRCode
                        backgroundColor={theme.colors.surface}
                        color={theme.colors.ink}
                        size={152}
                        value={model.serviceState.qrValue}
                      />
                      <Text style={styles.qrCaption}>
                        刷新 key 后旧二维码会立即失效，浏览器端需要重新扫描。
                      </Text>
                    </View>
                  ) : (
                    <EmptyState
                      body="启动服务后，这里会展示当前访问二维码。"
                      title="暂未生成二维码"
                    />
                  )}
                </View>
              </View>

              <View style={styles.card}>
                <SectionTitle
                  title="Session"
                  description="文件默认只保存在 App 内会话，不会自动进入系统下载目录或相册。"
                />
                <View
                  style={[
                    styles.sessionWorkspace,
                    isCompactLayout ? styles.sessionWorkspaceCompact : null,
                  ]}>
                  <View
                    style={[
                      styles.historySidebar,
                      isCompactLayout ? styles.historySidebarCompact : null,
                    ]}>
                    <View style={styles.historyHeader}>
                      <View style={styles.historyHeaderCopy}>
                        <Text style={styles.historyTitle}>历史记录</Text>
                        <Text style={styles.historyBody}>
                          项目历史以侧边栏保留。切换项目不会丢失当前会话文件和文本。
                        </Text>
                      </View>
                      <GhostButton
                        disabled={isBusy}
                        label="新建项目"
                        onPress={() => {
                          void model.createProject();
                        }}
                      />
                    </View>
                    <View style={styles.sessionInfoBanner}>
                      <Text style={styles.sessionInfoTitle}>入站结果反馈</Text>
                      <Text style={styles.sessionInfoBody}>
                        浏览器上传成功仅代表内容已写入本机 App 会话。若需要把文件留到系统“文件”或其他 App，
                        请在项目内显式点“导出”。
                      </Text>
                    </View>
                    <View style={styles.projectSidebarList}>
                      {model.projects.map(project => (
                        <ProjectPill
                          active={project.id === model.activeProject?.id}
                          key={project.id}
                          onPress={() => {
                            void model.selectProject(project.id);
                          }}
                          project={project}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.sessionMain}>
                    {model.activeProject ? (
                      <View style={styles.activeProjectShell}>
                        <View style={styles.activeProjectHeader}>
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
                            label="删除整个项目"
                            onPress={() => {
                              confirmDeleteProject(model.activeProject!);
                            }}
                          />
                        </View>

                        <View style={styles.subsection}>
                          <Text style={styles.subsectionTitle}>文本接收区</Text>
                          {model.activeProject.messages.length === 0 ? (
                            <EmptyState
                              body="浏览器提交文本后，会按时间线落到当前活跃项目。"
                              title="还没有文本消息"
                            />
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
                          <Text style={styles.subsectionTitle}>项目文件</Text>
                          {model.activeProjectFiles.length === 0 ? (
                            <EmptyState
                              body="浏览器上传的文件或文件夹会出现在这里，然后你可以手动加入共享或导出。"
                              title="当前项目还没有文件"
                            />
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

                        <View style={styles.subsection}>
                          <Text style={styles.subsectionTitle}>当前共享列表</Text>
                          <Text style={styles.subsectionHint}>
                            浏览器门户只会展示这里的文件。你也可以直接从本机选择文件加入共享，移出后对方下载列表会立即同步消失。
                          </Text>
                          <View style={styles.inlineActions}>
                            <GhostButton
                              disabled={isBusy}
                              label="从本机选择文件"
                              onPress={() => {
                                void model.importFilesForShare();
                              }}
                            />
                          </View>
                          {model.sharedFiles.length === 0 ? (
                            <EmptyState
                              body="先在项目文件中点“加入共享”，或者直接从本机选择文件加入共享，浏览器门户才会出现可下载文件。"
                              title="当前没有共享文件"
                            />
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
                    ) : (
                      <EmptyState
                        body="当前还没有活跃项目。点击左侧“新建项目”后，浏览器后续提交会进入该项目。"
                        title="没有可用项目"
                      />
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <SectionTitle
                  title="Portal"
                  description="浏览器端会读取当前共享列表，并按同一局域网地址完成上传、文本提交和下载。"
                />
                <View style={styles.portalPreview}>
                  <Text style={styles.portalPreviewTitle}>当前门户将展示</Text>
                  <Text style={styles.portalPreviewText}>
                    1. 文件 / 文件夹上传区
                  </Text>
                  <Text style={styles.portalPreviewText}>
                    2. 文本粘贴提交区
                  </Text>
                  <Text style={styles.portalPreviewText}>
                    3. 已加入共享的文件列表（当前 {model.sharedFiles.length}{' '}
                    个）
                  </Text>
                  <Text style={styles.portalPreviewText}>
                    4. 上传、分块下载、断连和认证失败提示
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type SectionTitleProps = {
  description: string;
  title: string;
};

function SectionTitle({description, title}: SectionTitleProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
    </View>
  );
}

type KeyValueRowProps = {
  label: string;
  value: string;
};

function KeyValueRow({label, value}: KeyValueRowProps) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value}</Text>
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
      style={[
        styles.primaryButton,
        disabled ? styles.buttonDisabled : null,
      ]}>
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
  onPress: () => void;
  project: ProjectRecord;
};

function ProjectPill({active, onPress, project}: ProjectPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.projectPill, active ? styles.projectPillActive : null]}>
      <Text
        style={[
          styles.projectTitle,
          active ? styles.projectTitleActive : null,
        ]}>
        {project.title}
      </Text>
      <Text
        style={[
          styles.projectMeta,
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
        {formatDateTime(message.createdAt)} · {message.source === 'browser' ? '浏览器提交' : 'App 内创建'}
      </Text>
      <View style={styles.inlineActions}>
        <GhostButton label="复制" onPress={onCopy} />
        <GhostButton label="删除单条" onPress={onDelete} />
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
          <Text style={styles.fileName}>{file.displayName}</Text>
          <Text style={styles.fileMeta}>
            {formatBytes(file.size)} ·{' '}
            {file.isLargeFile ? '大文件，跳过压缩' : '小文件，已压缩封装'}
          </Text>
          <Text style={styles.filePath}>{file.relativePath}</Text>
        </View>
        <Text style={[styles.fileTag, isShared ? styles.fileTagShared : null]}>
          {isShared ? '已共享' : '仅会话内'}
        </Text>
      </View>
      <View style={styles.inlineActions}>
        <GhostButton
          disabled={busy}
          label={isShared ? '移出共享' : '加入共享'}
          onPress={onToggleShare}
        />
        <GhostButton disabled={busy} label="导出" onPress={onExport} />
        <DangerGhostButton disabled={busy} label="删除文件" onPress={onDelete} />
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
          <Text style={styles.fileName}>{file.displayName}</Text>
          <Text style={styles.fileMeta}>
            {formatBytes(file.size)} · 来自 {projectTitle}
          </Text>
          <Text style={styles.filePath}>{file.relativePath}</Text>
        </View>
        <Text style={[styles.fileTag, styles.fileTagShared]}>已共享</Text>
      </View>
      <View style={styles.inlineActions}>
        <GhostButton disabled={busy} label="前往项目" onPress={onOpenProject} />
        <GhostButton disabled={busy} label="导出" onPress={onExport} />
        <GhostButton disabled={busy} label="移出共享" onPress={onRemoveShare} />
      </View>
    </View>
  );
}

type EmptyStateProps = {
  body: string;
  title: string;
};

function EmptyState({body, title}: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateBody}>{body}</Text>
    </View>
  );
}

type InlineNoticeProps = {
  label: string;
  message: string;
};

function InlineNotice({label, message}: InlineNoticeProps) {
  return (
    <View style={styles.inlineNotice}>
      <Text style={styles.inlineNoticeLabel}>{label}</Text>
      <Text style={styles.inlineNoticeText}>{message}</Text>
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
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

function resolvePhaseColor(phase: string) {
  switch (phase) {
    case 'running':
      return theme.colors.success;
    case 'error':
      return theme.colors.primary;
    case 'starting':
      return theme.colors.warning;
    default:
      return theme.colors.inkSoft;
  }
}

function resolvePhaseLabel(phase: string) {
  switch (phase) {
    case 'running':
      return '运行中';
    case 'starting':
      return '启动中';
    case 'error':
      return '需要处理';
    case 'stopped':
      return '已停止';
    default:
      return '空闲';
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: 28,
    padding: 24,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: theme.colors.surfaceStrong,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heroHint: {
    color: theme.colors.surfaceTint,
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: theme.colors.inkOnStrong,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: theme.colors.inkOnStrongSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    padding: 28,
  },
  loadingTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  loadingBody: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
    textAlign: 'center',
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
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.inkSoft,
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
  keyValueRow: {
    gap: 4,
  },
  keyLabel: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  keyValue: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  helperText: {
    color: theme.colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineNotice: {
    backgroundColor: theme.colors.warningSoft,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  inlineNoticeLabel: {
    color: theme.colors.warningStrong,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inlineNoticeText: {
    color: theme.colors.warningStrong,
    lineHeight: 20,
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
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
  },
  qrCaption: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
    textAlign: 'center',
  },
  sessionInfoBanner: {
    backgroundColor: theme.colors.secondarySoft,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  sessionInfoTitle: {
    color: theme.colors.ink,
    fontWeight: '800',
  },
  sessionInfoBody: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  sessionWorkspace: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  sessionWorkspaceCompact: {
    flexDirection: 'column',
  },
  historySidebar: {
    width: 290,
    gap: 14,
  },
  historySidebarCompact: {
    width: '100%',
  },
  historyHeader: {
    gap: 12,
  },
  historyHeaderCopy: {
    gap: 6,
  },
  historyTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  historyBody: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  projectSidebarList: {
    gap: 10,
  },
  sessionMain: {
    flex: 1,
    minWidth: 0,
    gap: 16,
  },
  labelText: {
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  projectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  projectPill: {
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  projectPillActive: {
    backgroundColor: theme.colors.secondary,
  },
  projectTitle: {
    color: theme.colors.ink,
    fontWeight: '800',
  },
  projectTitleActive: {
    color: theme.colors.ink,
  },
  projectMeta: {
    color: theme.colors.inkSoft,
    fontSize: 12,
  },
  projectMetaActive: {
    color: theme.colors.ink,
  },
  activeProjectShell: {
    gap: 16,
  },
  activeProjectHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
  subsection: {
    gap: 10,
  },
  subsectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  subsectionHint: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
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
    gap: 6,
    padding: 16,
  },
  emptyStateTitle: {
    color: theme.colors.ink,
    fontWeight: '800',
  },
  emptyStateBody: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  portalPreview: {
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 16,
    gap: 8,
  },
  portalPreviewTitle: {
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  portalPreviewText: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
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
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});

export default App;
