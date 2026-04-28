import React from 'react';

export type AppLocale = 'zh-CN' | 'en-US';

export const DEFAULT_APP_LOCALE: AppLocale = 'zh-CN';

export const SUPPORTED_APP_LOCALES: AppLocale[] = ['zh-CN', 'en-US'];

const zhCN = {
  'app.loading': '正在加载',
  'app.close': '关闭',
  'common.cancel': '取消',
  'common.complete': '完成',
  'common.copy': '复制',
  'common.delete': '删除',
  'common.export': '导出',
  'common.new': '新建',
  'common.next': '下一步',
  'common.previous': '上一步',
  'common.remove': '移除',
  'common.save': '保存',
  'common.skip': '跳过',
  'tabs.home': '首页',
  'tabs.settings': '设置',
  'settings.title': '设置',
  'settings.subtitle': '管理语言和应用偏好，当前只提供中文与 English。',
  'settings.preferences': '偏好设置',
  'settings.language.title': '语言',
  'settings.language.description': '选择 FileFlash Bridge 的显示语言。',
  'settings.language.portalHint': '浏览器门户会自动跟随这里的语言选择。',
  'settings.language.option.zh': '中文',
  'settings.language.option.en': 'English',
  'settings.language.openMenu': '打开语言菜单',
  'home.header.title': '工作台',
  'home.header.noProject': '未选择项目',
  'home.metric.connections': '连接',
  'home.metric.shared': '共享',
  'home.metric.mode': '模式',
  'home.mode.secure': '安全',
  'home.mode.simple': '简单',
  'home.mode.secureDetailed': '安全模式',
  'home.mode.simpleDetailed': '简单模式',
  'home.network.mode.offline': '无可用局域网',
  'home.network.mode.unknown': '网络未知',
  'home.sidebar.open': '打开项目历史',
  'home.sidebar.title': '项目历史',
  'home.sidebar.count': '{{count}} 个项目',
  'home.sidebar.empty': '还没有项目',
  'home.sidebar.new': '新建',
  'home.sidebar.menu': '打开项目操作',
  'home.sidebar.deleteProject': '删除项目',
  'home.sidebar.renameProject': '修改名称',
  'home.project.deleteTitle': '删除项目',
  'home.project.deleteBody': '删除将清除该会话的数据及关联文件。',
  'home.project.deleteConfirm': '删除',
  'home.project.renameTitle': '修改项目名称',
  'home.project.renamePlaceholder': '输入项目名称',
  'home.project.empty': '先创建一个项目',
  'home.project.textTitle': '文本',
  'home.project.textEmpty': '暂无文本',
  'home.project.filesTitle': '文件',
  'home.project.filesEmpty': '暂无文件',
  'home.project.summary': '{{messages}} 条文本 · {{files}} 个文件',
  'home.project.history.files': '{{count}} 个文件',
  'home.project.history.messages': '{{count}} 条文本',
  'home.service.title': '服务',
  'home.service.address': '地址',
  'home.service.copyLink': '复制链接',
  'home.service.refreshAddress': '刷新地址',
  'home.service.start': '启动服务',
  'home.service.stop': '停止服务',
  'home.service.accessMode': '访问模式',
  'home.service.securityMode': '安全模式',
  'home.service.securityModeHelpTitle': '安全模式',
  'home.service.securityModeHelpBody':
    '开启后链接与二维码会携带访问密钥；关闭后为简单模式。',
  'home.service.network': '网络',
  'home.service.networkStatus': '网络状态',
  'home.service.networkHelp': '查看网络说明',
  'home.service.networkHelpTitle': '网络状态',
  'home.service.networkCurrent': '当前网络：{{label}}',
  'home.service.networkUnavailable':
    '没有检测到可被其他设备访问的地址，请检查当前 Wi-Fi 或热点连接。',
  'home.service.addressPlaceholder': '启动后显示浏览器入口',
  'home.service.noAddressTitle': '没有可复制的地址',
  'home.service.noAddressBody': '请先启动服务。',
  'home.service.copiedTitle': '已复制',
  'home.service.copiedBody': '链接已复制到剪贴板。',
  'home.service.online': '服务在线',
  'home.service.offline': '服务离线',
  'home.shared.title': '共享文件',
  'home.shared.importFiles': '文件',
  'home.shared.importMedia': '图库',
  'home.shared.empty': '暂无共享文件',
  'home.shared.unnamedProject': '未命名项目',
  'home.help.reopen': '重新查看引导',
  'message.source.browser': '浏览器',
  'message.source.app': 'App',
  'file.receivedAt': '接收时间 {{date}}',
  'file.shared': '已共享',
  'file.notShared': '未共享',
  'file.addToShare': '加入共享',
  'file.removeFromShare': '移出共享',
  'onboarding.close': '关闭新手引导',
  'onboarding.previous': '上一步',
  'onboarding.skip': '跳过',
  'onboarding.next': '下一步',
  'onboarding.complete': '完成',
  'onboarding.service.title.running': '先看看服务中心',
  'onboarding.service.body.running':
    '这里是服务中心。你可以查看当前地址、确认网络状态，并随时停止或继续使用当前服务。',
  'onboarding.service.title.stopped': '先从这里启动服务',
  'onboarding.service.body.stopped':
    '先从这里启动服务。服务开启后，浏览器入口和二维码才会出现，其他设备才能访问你的共享内容。',
  'onboarding.shared.title': '共享文件会先集中到这里',
  'onboarding.shared.body':
    '通过系统分享、相册或文件导入进来的内容都会先进入共享文件区。FileFlash Bridge 也支持从其他 App 直接把文件分享到这里，再继续分析和整理。',
  'onboarding.project.title': '项目区负责整理本次内容',
  'onboarding.project.body':
    '每次新建项目后，这里会展示当前项目里的文本和文件结果，方便你继续查看、分析和导出。iOS 可在 App Store 评论反馈，Android 可在 GitHub 提修改意见，我会认真听取并持续优化。',
  'notice.imported.both': '已接收 {{fileCount}} 个共享文件和 {{textCount}} 条共享文本。',
  'notice.imported.files': '已接收 {{fileCount}} 个共享文件，并加入共享列表。',
  'notice.imported.texts': '已接收 {{textCount}} 条共享文本，并加入当前项目。',
  'notice.resumedForeground': '应用回到前台后，服务已恢复。',
  'notice.serviceStarted': '服务状态已更新，当前会话内容可继续管理。',
  'notice.serviceStopped': '服务已停止，外部连接已被清理。',
  'notice.securityModeSecure': '已切换到安全模式，访问需携带 key。',
  'notice.projectCreated': '已创建新的分享项目，后续内容会进入这个项目。',
  'notice.projectRenamed': '项目名称已更新。',
  'notice.fileUnshared': '文件已从当前共享列表移除。',
  'notice.fileShared': '文件已加入当前共享列表，可供浏览器下载。',
  'notice.messageDeleted': '这条文本记录已删除。',
  'notice.projectDeleted': '项目及其关联文件已删除。',
  'notice.fileDeleted': '文件已从当前项目中删除。',
  'notice.textCopied': '文本已复制到系统剪贴板。',
  'notice.importFiles': '已从设备导入 {{count}} 个文件，并加入共享。',
  'notice.importMedia': '已从图库导入 {{count}} 个媒体项，并加入共享。',
  'notice.addressRefreshed':
    '访问地址与访问密钥已刷新，请使用 App 内最新链接与二维码；旧链接与旧二维码已失效。',
  'notice.export.saved': '已保存到你选择的位置：{{name}}',
  'notice.export.ios': '已打开“存储到文件”流程：{{name}}',
  'notice.export.share': '已打开系统分享流程：{{name}}',
  'error.unknown': '出现了未知错误，请稍后重试。',
  'error.exportFailed': '导出失败：{{message}}',
  'project.defaultTitle': '项目 {{count}}',
  'project.currentRound': '当前分享轮次',
  'portal.title': '{{deviceName}} 的 FileFlash Bridge',
  'portal.heroTitle': '浏览器投递',
  'portal.deviceLabel': '设备：{{deviceName}}',
  'portal.eyebrowUpload': '拖拽投递',
  'portal.eyebrowText': '粘贴发送',
  'portal.eyebrowShared': '手机共享',
  'portal.sectionUpload': '上传到手机',
  'portal.uploadPrompt': '拖拽文件到这里，或选择文件 / 文件夹',
  'portal.chooseFiles': '选择文件',
  'portal.chooseFolders': '选择文件夹',
  'portal.uploadSelection': '上传所选内容',
  'portal.emptyUpload': '还没有待上传内容',
  'portal.sectionText': '发送文本',
  'portal.textPlaceholder': '粘贴文本后直接提交',
  'portal.submitText': '提交文本',
  'portal.refresh': '刷新状态',
  'portal.sectionShared': '共享文件',
  'portal.sharedUnavailable': '当前无法读取共享列表',
  'portal.emptyShared': '还没有共享文件',
  'portal.serviceOnline': '服务在线',
  'portal.serviceOffline': '服务离线',
  'portal.browserUnavailable': '手机端服务不可用，请确认 App 仍在运行。',
  'portal.selectFilesFirst': '请先选择要上传的文件或文件夹。',
  'portal.requestFailed': '请求失败',
  'portal.networkInterrupted': '网络中断，上传未完成',
  'portal.upload.pending': '待上传',
  'portal.upload.inProgress': '上传中',
  'portal.upload.complete': '完成',
  'portal.upload.failed': '失败',
  'portal.upload.sentToPhone': '已送达手机',
  'portal.download.button': '下载',
  'portal.download.buttonBusy': '下载中',
  'portal.download.buttonAgain': '重新下载',
  'portal.download.pending': '待下载',
  'portal.download.inProgress': '下载中 {{percent}}%',
  'portal.download.complete': '已完成',
  'portal.download.failed': '下载失败：{{message}}',
  'portal.download.chunked': '分块下载',
  'portal.download.bannerFailed': '下载失败，请检查网络后重试。',
  'portal.text.empty': '请先输入或粘贴要发送的文本。',
  'portal.text.sentTo': '已发送到：{{projectTitle}}',
  'portal.unauthorizedTitle': '需要重新获取链接',
  'portal.unauthorizedInstruction':
    '请回到手机端，复制最新 URL 或重新扫描二维码后再访问。',
  'api.status.simpleNotice': '当前为简单模式，仅建议在可信 Wi-Fi 或热点使用。',
  'api.status.secureNotice': '当前为安全模式，链接和二维码已携带 key。',
  'api.unauthorized': '未授权访问',
  'api.networkUnavailable':
    '当前网络无法被同一局域网中的设备访问，请切换到可用 Wi-Fi 或热点。',
  'api.switchNetworkRetry': '切换网络后重试',
  'api.startServiceFailed': '服务启动失败，请稍后重试。',
  'api.changePortOrStopConflict': '更换端口或停止占用该端口的服务',
  'api.addressUnavailable':
    '没有检测到可被其他设备访问的地址，请检查当前 Wi-Fi 或热点连接。',
  'api.switchNetworkOrRefresh': '切换网络或重试刷新',
  'api.networkRefreshed': '网络地址已刷新，旧地址应视为失效。',
  'api.useNewAddress': '请使用新地址重新访问',
  'api.invalidJsonObject': '请求体必须是 JSON 对象。',
  'api.invalidUploadBeginFields': '请提供有效的 name、relativePath 和 totalBytes。',
  'api.cannotStartChunkedUpload': '无法开始分块上传。',
  'api.chunkWriteFailed': '分块写入失败。',
  'api.finishChunkedUploadFailed': '无法完成分块上传。',
  'api.missingUploadId': '缺少 uploadId。',
  'api.noFilesUploaded': '请至少上传一个文件。',
  'api.fileSavedToSession': '文件已写入手机端 App 内会话存储。',
  'api.emptySubmittedText': '请先输入要提交的文本内容。',
  'api.textTooLarge': '文本内容超过当前服务允许的上限。',
  'api.resourceNotFound': '未找到请求的资源。',
  'api.storageUnknown': '服务处理请求时发生未知错误。',
} as const;

type TranslationKey = keyof typeof zhCN;

const enUS: Record<TranslationKey, string> = {
  'app.loading': 'Loading',
  'app.close': 'Close',
  'common.cancel': 'Cancel',
  'common.complete': 'Done',
  'common.copy': 'Copy',
  'common.delete': 'Delete',
  'common.export': 'Export',
  'common.new': 'New',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.remove': 'Remove',
  'common.save': 'Save',
  'common.skip': 'Skip',
  'tabs.home': 'Home',
  'tabs.settings': 'Settings',
  'settings.title': 'Settings',
  'settings.subtitle':
    'Manage language and app preferences. Only Chinese and English are available for now.',
  'settings.preferences': 'Preferences',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose how FileFlash Bridge is displayed.',
  'settings.language.portalHint': 'The browser portal automatically follows this choice.',
  'settings.language.option.zh': 'Chinese',
  'settings.language.option.en': 'English',
  'settings.language.openMenu': 'Open language menu',
  'home.header.title': 'Workbench',
  'home.header.noProject': 'No project selected',
  'home.metric.connections': 'Connections',
  'home.metric.shared': 'Shared',
  'home.metric.mode': 'Mode',
  'home.mode.secure': 'Secure',
  'home.mode.simple': 'Simple',
  'home.mode.secureDetailed': 'Secure mode',
  'home.mode.simpleDetailed': 'Simple mode',
  'home.network.mode.offline': 'No LAN available',
  'home.network.mode.unknown': 'Unknown network',
  'home.sidebar.open': 'Open project history',
  'home.sidebar.title': 'Project History',
  'home.sidebar.count': '{{count}} projects',
  'home.sidebar.empty': 'No projects yet',
  'home.sidebar.new': 'New',
  'home.sidebar.menu': 'Open project actions',
  'home.sidebar.deleteProject': 'Delete project',
  'home.sidebar.renameProject': 'Rename project',
  'home.project.deleteTitle': 'Delete Project',
  'home.project.deleteBody': 'Deleting will clear this session and its related files.',
  'home.project.deleteConfirm': 'Delete',
  'home.project.renameTitle': 'Rename project',
  'home.project.renamePlaceholder': 'Enter a project name',
  'home.project.empty': 'Create a project first',
  'home.project.textTitle': 'Text',
  'home.project.textEmpty': 'No text yet',
  'home.project.filesTitle': 'Files',
  'home.project.filesEmpty': 'No files yet',
  'home.project.summary': '{{messages}} texts · {{files}} files',
  'home.project.history.files': '{{count}} files',
  'home.project.history.messages': '{{count}} texts',
  'home.service.title': 'Service',
  'home.service.address': 'Address',
  'home.service.copyLink': 'Copy link',
  'home.service.refreshAddress': 'Refresh address',
  'home.service.start': 'Start service',
  'home.service.stop': 'Stop service',
  'home.service.accessMode': 'Access mode',
  'home.service.securityMode': 'Security mode',
  'home.service.securityModeHelpTitle': 'Security Mode',
  'home.service.securityModeHelpBody':
    'When enabled, the link and QR code include an access key. When disabled, simple mode is used.',
  'home.service.network': 'Network',
  'home.service.networkStatus': 'Network status',
  'home.service.networkHelp': 'View network details',
  'home.service.networkHelpTitle': 'Network Status',
  'home.service.networkCurrent': 'Current network: {{label}}',
  'home.service.networkUnavailable':
    'No address is reachable from other devices. Check the current Wi-Fi or hotspot connection.',
  'home.service.addressPlaceholder': 'Start the service to reveal the browser entry.',
  'home.service.noAddressTitle': 'No address to copy',
  'home.service.noAddressBody': 'Start the service first.',
  'home.service.copiedTitle': 'Copied',
  'home.service.copiedBody': 'The link has been copied to the clipboard.',
  'home.service.online': 'Service online',
  'home.service.offline': 'Service offline',
  'home.shared.title': 'Shared Files',
  'home.shared.importFiles': 'Files',
  'home.shared.importMedia': 'Gallery',
  'home.shared.empty': 'No shared files yet',
  'home.shared.unnamedProject': 'Untitled project',
  'home.help.reopen': 'Reopen onboarding',
  'message.source.browser': 'Browser',
  'message.source.app': 'App',
  'file.receivedAt': 'Received {{date}}',
  'file.shared': 'Shared',
  'file.notShared': 'Not shared',
  'file.addToShare': 'Add to sharing',
  'file.removeFromShare': 'Remove from sharing',
  'onboarding.close': 'Close onboarding',
  'onboarding.previous': 'Previous',
  'onboarding.skip': 'Skip',
  'onboarding.next': 'Next',
  'onboarding.complete': 'Done',
  'onboarding.service.title.running': 'Start with the service center',
  'onboarding.service.body.running':
    'This is the service center. You can review the current address, confirm network status, and keep or stop the service at any time.',
  'onboarding.service.title.stopped': 'Start the service here first',
  'onboarding.service.body.stopped':
    'Start the service here first. Once it is running, the browser entry and QR code will appear so other devices can reach your shared content.',
  'onboarding.shared.title': 'Shared files gather here first',
  'onboarding.shared.body':
    'Anything brought in through system share, the gallery, or file import lands in Shared Files first. FileFlash Bridge also supports sharing files in directly from other apps before you analyze or organize them.',
  'onboarding.project.title': 'Projects organize the current session',
  'onboarding.project.body':
    'Each new project collects the text and file results for that round so you can keep reviewing, analyzing, and exporting them. iOS users can leave feedback in an App Store review, and Android users can share change requests on GitHub. I will keep listening and improving the app.',
  'notice.imported.both':
    'Received {{fileCount}} shared files and {{textCount}} shared notes.',
  'notice.imported.files':
    'Received {{fileCount}} shared files and added them to sharing.',
  'notice.imported.texts':
    'Received {{textCount}} shared notes and added them to the current project.',
  'notice.resumedForeground': 'The service resumed after the app returned to the foreground.',
  'notice.serviceStarted': 'The service status was updated and the current session remains available.',
  'notice.serviceStopped': 'The service stopped and external connections were cleared.',
  'notice.securityModeSecure': 'Switched to secure mode. Access now requires the key.',
  'notice.projectCreated': 'Created a new project. Incoming content will go there next.',
  'notice.projectRenamed': 'Project name updated.',
  'notice.fileUnshared': 'The file was removed from the current shared list.',
  'notice.fileShared': 'The file was added to the current shared list for browser download.',
  'notice.messageDeleted': 'The text record was deleted.',
  'notice.projectDeleted': 'The project and its related files were deleted.',
  'notice.fileDeleted': 'The file was removed from the current project.',
  'notice.textCopied': 'The text was copied to the system clipboard.',
  'notice.importFiles': 'Imported {{count}} files from this device and added them to sharing.',
  'notice.importMedia':
    'Imported {{count}} media items from the gallery and added them to sharing.',
  'notice.addressRefreshed':
    'The access URL and key were refreshed. Use the latest in-app link and QR code. Older ones no longer work.',
  'notice.export.saved': 'Saved to your chosen location: {{name}}',
  'notice.export.ios': 'Opened the Save to Files flow: {{name}}',
  'notice.export.share': 'Opened the system share flow: {{name}}',
  'error.unknown': 'An unknown error occurred. Please try again later.',
  'error.exportFailed': 'Export failed: {{message}}',
  'project.defaultTitle': 'Project {{count}}',
  'project.currentRound': 'Current sharing round',
  'portal.title': '{{deviceName}} FileFlash Bridge',
  'portal.heroTitle': 'Browser Transfer',
  'portal.deviceLabel': 'Device: {{deviceName}}',
  'portal.eyebrowUpload': 'Drop & Deliver',
  'portal.eyebrowText': 'Paste & Send',
  'portal.eyebrowShared': 'Shared From Phone',
  'portal.sectionUpload': 'Upload to Phone',
  'portal.uploadPrompt': 'Drop files here, or choose files / folders',
  'portal.chooseFiles': 'Choose files',
  'portal.chooseFolders': 'Choose folders',
  'portal.uploadSelection': 'Upload selection',
  'portal.emptyUpload': 'Nothing queued for upload yet',
  'portal.sectionText': 'Send Text',
  'portal.textPlaceholder': 'Paste text and submit it directly',
  'portal.submitText': 'Submit text',
  'portal.refresh': 'Refresh status',
  'portal.sectionShared': 'Shared Files',
  'portal.sharedUnavailable': 'Unable to load the shared list right now',
  'portal.emptyShared': 'No shared files yet',
  'portal.serviceOnline': 'Service online',
  'portal.serviceOffline': 'Service offline',
  'portal.browserUnavailable':
    'The service on the phone is unavailable. Make sure the app is still running.',
  'portal.selectFilesFirst': 'Choose files or folders to upload first.',
  'portal.requestFailed': 'Request failed',
  'portal.networkInterrupted': 'The network was interrupted before the upload finished.',
  'portal.upload.pending': 'Pending',
  'portal.upload.inProgress': 'Uploading',
  'portal.upload.complete': 'Done',
  'portal.upload.failed': 'Failed',
  'portal.upload.sentToPhone': 'Delivered to phone',
  'portal.download.button': 'Download',
  'portal.download.buttonBusy': 'Downloading',
  'portal.download.buttonAgain': 'Download again',
  'portal.download.pending': 'Waiting to download',
  'portal.download.inProgress': 'Downloading {{percent}}%',
  'portal.download.complete': 'Completed',
  'portal.download.failed': 'Download failed: {{message}}',
  'portal.download.chunked': 'Chunked download',
  'portal.download.bannerFailed': 'Download failed. Check the network and try again.',
  'portal.text.empty': 'Enter or paste some text first.',
  'portal.text.sentTo': 'Sent to: {{projectTitle}}',
  'portal.unauthorizedTitle': 'Get a fresh link',
  'portal.unauthorizedInstruction':
    'Go back to the phone app, copy the latest URL, or scan the QR code again before visiting.',
  'api.status.simpleNotice':
    'Simple mode is active. Use it only on a trusted Wi-Fi or hotspot.',
  'api.status.secureNotice':
    'Secure mode is active. The link and QR code already include the key.',
  'api.unauthorized': 'Unauthorized access',
  'api.networkUnavailable':
    'The current network is not reachable from other devices on the same LAN. Switch to an available Wi-Fi or hotspot.',
  'api.switchNetworkRetry': 'Switch networks and try again',
  'api.startServiceFailed': 'The service failed to start. Please try again later.',
  'api.changePortOrStopConflict': 'Change the port or stop the service using it',
  'api.addressUnavailable':
    'No address is reachable from other devices. Check the current Wi-Fi or hotspot connection.',
  'api.switchNetworkOrRefresh': 'Switch networks or refresh again',
  'api.networkRefreshed': 'The network address was refreshed and the old address is now invalid.',
  'api.useNewAddress': 'Use the new address to reconnect',
  'api.invalidJsonObject': 'The request body must be a JSON object.',
  'api.invalidUploadBeginFields':
    'Provide valid name, relativePath, and totalBytes values.',
  'api.cannotStartChunkedUpload': 'Unable to start the chunked upload.',
  'api.chunkWriteFailed': 'Failed to write the upload chunk.',
  'api.finishChunkedUploadFailed': 'Unable to finish the chunked upload.',
  'api.missingUploadId': 'Missing uploadId.',
  'api.noFilesUploaded': 'Upload at least one file.',
  'api.fileSavedToSession': 'The file was saved into the phone app session.',
  'api.emptySubmittedText': 'Enter some text before submitting.',
  'api.textTooLarge': 'The text is larger than the current service allows.',
  'api.resourceNotFound': 'The requested resource was not found.',
  'api.storageUnknown': 'An unknown error occurred while handling the request.',
};

const resources: Record<AppLocale, Record<TranslationKey, string>> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

export const APP_LOCALE_OPTIONS: Array<{
  labelKey: TranslationKey;
  value: AppLocale;
}> = [
  {labelKey: 'settings.language.option.zh', value: 'zh-CN'},
  {labelKey: 'settings.language.option.en', value: 'en-US'},
];

export function isSupportedAppLocale(value: unknown): value is AppLocale {
  return value === 'zh-CN' || value === 'en-US';
}

export function resolveAppLocale(value: unknown): AppLocale {
  return isSupportedAppLocale(value) ? value : DEFAULT_APP_LOCALE;
}

function interpolate(
  template: string,
  params?: Record<string, number | string | undefined>,
) {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) => {
    const value = params[token];
    return value == null ? '' : String(value);
  });
}

export function translateApp(
  locale: AppLocale,
  key: TranslationKey,
  params?: Record<string, number | string | undefined>,
) {
  const template = resources[locale][key] ?? resources[DEFAULT_APP_LOCALE][key];
  return interpolate(template, params);
}

export function createAppTranslator(locale: AppLocale) {
  return (
    key: TranslationKey,
    params?: Record<string, number | string | undefined>,
  ) => translateApp(locale, key, params);
}

type AppI18nContextValue = {
  locale: AppLocale;
  t: ReturnType<typeof createAppTranslator>;
};

const AppI18nContext = React.createContext<AppI18nContextValue>({
  locale: DEFAULT_APP_LOCALE,
  t: createAppTranslator(DEFAULT_APP_LOCALE),
});

export function AppI18nProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: AppLocale;
}) {
  const value = React.useMemo(
    () => ({
      locale,
      t: createAppTranslator(locale),
    }),
    [locale],
  );

  return (
    <AppI18nContext.Provider value={value}>{children}</AppI18nContext.Provider>
  );
}

export function useAppI18n() {
  return React.useContext(AppI18nContext);
}

export function getPortalDocumentText(locale: AppLocale) {
  const t = createAppTranslator(locale);

  return {
    browserUnavailable: t('portal.browserUnavailable'),
    chooseFiles: t('portal.chooseFiles'),
    chooseFolders: t('portal.chooseFolders'),
    deviceLabel: t('portal.deviceLabel'),
    downloadBannerFailed: t('portal.download.bannerFailed'),
    downloadButton: t('portal.download.button'),
    downloadButtonAgain: t('portal.download.buttonAgain'),
    downloadButtonBusy: t('portal.download.buttonBusy'),
    downloadComplete: t('portal.download.complete'),
    downloadFailed: t('portal.download.failed'),
    downloadInProgress: t('portal.download.inProgress'),
    downloadPending: t('portal.download.pending'),
    emptyShared: t('portal.emptyShared'),
    emptyUpload: t('portal.emptyUpload'),
    heroTitle: t('portal.heroTitle'),
    networkInterrupted: t('portal.networkInterrupted'),
    requestFailed: t('portal.requestFailed'),
    sectionShared: t('portal.sectionShared'),
    sectionText: t('portal.sectionText'),
    sectionUpload: t('portal.sectionUpload'),
    selectFilesFirst: t('portal.selectFilesFirst'),
    serviceOffline: t('portal.serviceOffline'),
    serviceOnline: t('portal.serviceOnline'),
    sharedUnavailable: t('portal.sharedUnavailable'),
    submitText: t('portal.submitText'),
    textEmpty: t('portal.text.empty'),
    textPlaceholder: t('portal.textPlaceholder'),
    textSentTo: t('portal.text.sentTo'),
    title: t('portal.title'),
    unauthorizedInstruction: t('portal.unauthorizedInstruction'),
    unauthorizedTitle: t('portal.unauthorizedTitle'),
    uploadComplete: t('portal.upload.complete'),
    uploadFailed: t('portal.upload.failed'),
    uploadInProgress: t('portal.upload.inProgress'),
    uploadPending: t('portal.upload.pending'),
    uploadPrompt: t('portal.uploadPrompt'),
    uploadSelection: t('portal.uploadSelection'),
    uploadSentToPhone: t('portal.upload.sentToPhone'),
  };
}
