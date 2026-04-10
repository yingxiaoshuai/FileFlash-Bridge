import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {theme} from './src/app/theme';
import {useDemoAppModel} from './src/app/useDemoAppModel';
import {ProjectRecord} from './src/modules/service/models';

function App(): React.JSX.Element {
  const model = useDemoAppModel();
  const [linkNotice, setLinkNotice] = React.useState<string | undefined>();
  const activeProject = model.projects.find(
    project => project.id === model.serviceState.activeProjectId,
  );

  const handleCopyLink = () => {
    if (!model.serviceState.accessUrl) {
      setLinkNotice('服务未启动，暂时没有可复制的访问地址。');
      return;
    }

    Clipboard.setString(model.serviceState.accessUrl);
    setLinkNotice('访问链接已复制，二维码与 URL 已同步当前 key。');
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
                <Text style={styles.heroBadgeText}>OpenSpec V1</Text>
              </View>
              <Text style={styles.heroHint}>React Native + TypeScript</Text>
            </View>
            <Text style={styles.heroTitle}>FileFlash Bridge</Text>
            <Text style={styles.heroSubtitle}>
              把手机变成局域网里的轻量接收站，浏览器扫一扫就能投递文件、
              文本，并从当前共享列表拉取内容。
            </Text>
            <View style={styles.heroActions}>
              <PrimaryButton
                label={
                  model.serviceState.phase === 'running' ? '停止服务' : '启动服务'
                }
                onPress={model.toggleService}
              />
              <GhostButton label="刷新地址" onPress={model.refreshAddress} />
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.card}>
              <SectionTitle
                title="Service"
                description="状态、地址、网络模式和运行错误全部走统一模型。"
              />
              <StatusChip
                label={
                  model.serviceState.phase === 'running' ? '运行中' : '已停止'
                }
                accent={
                  model.serviceState.phase === 'running'
                    ? theme.colors.success
                    : theme.colors.warning
                }
              />
              <KeyValueRow
                label="网络模式"
                value={model.serviceState.network.label}
              />
              <KeyValueRow
                label="访问地址"
                value={model.serviceState.accessUrl ?? '等待启动服务'}
              />
              <KeyValueRow
                label="活跃连接"
                value={String(model.serviceState.activeConnections.length)}
              />
              {model.serviceState.error ? (
                <View style={styles.inlineNotice}>
                  <Text style={styles.inlineNoticeLabel}>恢复入口</Text>
                  <Text style={styles.inlineNoticeText}>
                    {model.serviceState.error.message}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <SectionTitle
                title="Security"
                description="简单模式只给 URL，安全模式会把 key 带进二维码和链接。"
              />
              <View style={styles.modeRow}>
                <ModePill
                  label="简单模式"
                  active={model.serviceState.config.securityMode === 'simple'}
                  onPress={() => model.setSecurityMode('simple')}
                />
                <ModePill
                  label="安全模式"
                  active={model.serviceState.config.securityMode === 'secure'}
                  onPress={() => model.setSecurityMode('secure')}
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
                label="同步链接"
                value={model.serviceState.accessUrl ?? '等待启动服务'}
              />
              <Text style={styles.helperText}>{model.securityCopy}</Text>
              <View style={styles.heroActions}>
                <GhostButton label="复制链接" onPress={handleCopyLink} />
                <GhostButton label="刷新 key" onPress={model.rotateKey} />
              </View>
              {linkNotice ? (
                <Text style={styles.linkNotice}>{linkNotice}</Text>
              ) : null}
              {model.serviceState.qrValue ? (
                <View style={styles.qrPanel}>
                  <QRCode
                    size={152}
                    value={model.serviceState.qrValue}
                    color={theme.colors.ink}
                    backgroundColor={theme.colors.surface}
                  />
                  <Text style={styles.qrCaption}>
                    二维码始终和当前访问链接保持同步，刷新 key 后旧码立即失效。
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.card}>
              <SectionTitle
                title="File Access"
                description="会话内入站存储、显式导出、共享列表和删除提醒都从这里挂起。"
              />
              <Text style={styles.listHint}>
                当前活跃项目会接住新的文本和文件，文件默认只留在 App
                内会话，不会自动进入系统下载或相册。
              </Text>
              <Text style={styles.labelText}>项目 / 会话</Text>
              <View style={styles.projectList}>
                {model.projects.map(project => (
                  <ProjectPill
                    key={project.id}
                    project={project}
                    active={project.id === model.serviceState.activeProjectId}
                    onPress={() => model.selectProject(project.id)}
                  />
                ))}
              </View>
              <Text style={styles.labelText}>当前共享文件</Text>
              {model.sharedFiles.map(file => (
                <View key={file.id} style={styles.fileRow}>
                  <View>
                    <Text style={styles.fileName}>{file.displayName}</Text>
                    <Text style={styles.fileMeta}>
                      {formatBytes(file.size)} ·{' '}
                      {file.isLargeFile ? '分块下载' : '整文件下载'}
                    </Text>
                  </View>
                  <Text style={styles.fileTag}>已共享</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <SectionTitle
                title="Portal"
                description="同源门户会承载文件选择、拖拽上传、文本提交和分块下载反馈。"
              />
              <Text style={styles.portalLead}>
                浏览器端会用同一个门户页面完成上传、文本提交和共享文件下载。
              </Text>
              <View style={styles.portalPreview}>
                <Text style={styles.portalPreviewTitle}>门户关键区块</Text>
                <Text style={styles.portalPreviewText}>
                  1. 文件 / 文件夹上传区
                </Text>
                <Text style={styles.portalPreviewText}>2. 文本粘贴提交区</Text>
                <Text style={styles.portalPreviewText}>
                  3. 当前共享文件下载区
                </Text>
                <Text style={styles.portalPreviewText}>
                  4. 断连、认证失败和重试提示
                </Text>
              </View>
              {activeProject ? (
                <View style={styles.activeProjectCard}>
                  <Text style={styles.activeProjectTitle}>
                    当前活跃项目: {activeProject.title}
                  </Text>
                  <Text style={styles.activeProjectMeta}>
                    历史文本提交会追加到这里，直到用户新建项目或主动删除。
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type SectionTitleProps = {
  title: string;
  description: string;
};

function SectionTitle({title, description}: SectionTitleProps) {
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
  label: string;
  accent: string;
};

function StatusChip({label, accent}: StatusChipProps) {
  return (
    <View style={[styles.statusChip, {borderColor: accent}]}>
      <View style={[styles.statusDot, {backgroundColor: accent}]} />
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
};

function PrimaryButton({label, onPress}: ButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({label, onPress}: ButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.ghostButton}>
      <Text style={styles.ghostButtonLabel}>{label}</Text>
    </Pressable>
  );
}

type ModePillProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function ModePill({label, active, onPress}: ModePillProps) {
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
  project: ProjectRecord;
  active: boolean;
  onPress: () => void;
};

function ProjectPill({project, active, onPress}: ProjectPillProps) {
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
        {project.messages.length} 条消息
      </Text>
    </Pressable>
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
  helperText: {
    color: theme.colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  linkNotice: {
    color: theme.colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
  projectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  projectPill: {
    minWidth: 132,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
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
  listHint: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  labelText: {
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  fileName: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  fileMeta: {
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  fileTag: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  portalLead: {
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
  activeProjectCard: {
    borderRadius: 18,
    backgroundColor: theme.colors.secondarySoft,
    padding: 16,
    gap: 6,
  },
  activeProjectTitle: {
    color: theme.colors.ink,
    fontWeight: '800',
  },
  activeProjectMeta: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
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
});

export default App;
