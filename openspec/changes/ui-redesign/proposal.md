## Why

当前首页已经承载服务启停、二维码、共享文件、项目内容、导入、导出、删除和设置入口，但视觉层级仍然容易显得“所有功能挤在一起”。用户需要的是按真实使用顺序展开的工作台：服务未启动时只强调启动服务；服务启动后再进入内容与共享工作区，并且共享/导入和查看项目不能被拆成两个互相隔离的页面，因为别人发送的文件也需要继续被加入共享、导出或管理。

本次变更要把 `ui-redesign` 从“依赖 iOS 原生设计库的大改造”修正为适合 FileFlash-Bridge 当前系统的跨平台 UI 改造。方案优先复用现有 React Native 共享层、React Native Paper、项目主题 token、项目本地图标组件和已有首页/设置页结构，避免引入不存在或高风险的原生 UI 依赖。

## What Changes

- 首页改为任务驱动的分步视觉层级：
  - 服务未启动：首屏中心只突出启动服务入口、网络状态和必要错误反馈。
  - 服务已启动：服务信息压缩为摘要，主要展示“内容与共享工作区”。
- 保持共享/导入、收到文件、项目查看、加入共享、导出保存和删除管理在同一个工作区协同呈现。
- 建立更清晰的跨平台设计 token：背景、表面、强调色、文本层级、8pt 间距、圆角、阴影和状态色。
- 将高频工具操作改为图标优先，并保留 `accessibilityLabel`、`testID` 和必要文字确认。
- 复用项目内 `src/app/icons/AppIcons*.tsx` 图标抽象，不使用不存在的 `react-native-sf-symbols`，也不新增 Material Icons 原生配置。
- 使用 React Native / React Native Paper 可落地的半透明表面、边框、阴影和按压反馈，不把 BlurView 作为 V1 必需依赖。
- 使用 React Native `Animated` 或 Paper 现有交互能力实现轻量动效，所有可原生驱动的动画使用 `useNativeDriver: true`。
- 保持 iOS、Android、Harmony 的核心功能一致，视觉上可按平台能力降级，但不得破坏局域网投递、文件导入/保存、文本提交和共享管理。

## Capabilities

### New Capabilities

- `cross-platform-design-system`: 适合 RN/Paper/Harmony 的高级视觉 token，覆盖色彩、间距、圆角、阴影和状态反馈。
- `project-icon-system`: 项目本地图标体系，统一图标尺寸、权重、可访问语义和平台降级。
- `workspace-stepwise-ui`: 首页按“启动服务 -> 内容与共享工作区”组织主流程，并保持共享与项目内容协同。
- `native-feeling-motion`: 轻量、可回滚、跨平台的按压反馈和页面/面板过渡动效。

### Modified Capabilities

- `workspace-visual-refresh`: 从单纯 Apple 风格调整为更适合本项目的跨平台高级工作台视觉。
- `mobile-tab-navigation`: 底部 Tab 保持 Home/Settings 两入口，样式与新的工作台 token 保持一致。

## Impact

**受影响的代码：**
- `src/app/theme.ts`、`src/app/paperTheme.ts` - 集成新的跨平台视觉 token。
- `src/app/ui.tsx` - 升级 `ActionButton`、`PanelSurface`、`GlyphIconButton` 等共享组件。
- `src/app/icons/AppIcons*.tsx` - 扩展高频工具图标，替换文字符号。
- `src/app/appShellStyles.ts` - 调整首页、设置页、底部 Tab、项目/共享工作区的视觉层级。
- `src/app/screens/HomeScreen.tsx` - 落地启动前居中主入口、启动后内容与共享工作区。
- `src/app/screens/SettingsScreen.tsx` - 保持设置页与首页同一视觉系统。
- `src/app/navigation/AppBottomTabBar.tsx` - 底部导航与新 token、图标体系对齐。

**依赖策略：**
- 不安装 `react-native-sf-symbols`：该包在 npm 官方 registry 不存在。
- 不把 `@react-native-community/blur` 作为 V1 必需依赖：毛玻璃在 Harmony/Android 的兼容与性能风险高。
- 不把 `react-native-reanimated` 作为 V1 必需依赖：当前需求可先用 React Native `Animated` 和 Paper 交互能力完成。
- 仅在后续明确需要真实原生模糊或复杂手势动画时，再单独提出依赖变更。

**平台兼容性：**
- iOS：使用系统字体、RN/Paper 控件、项目 SVG 图标和 iOS 质感参数。
- Android：保持 Material 交互语义与项目 PNG/SVG 图标降级，不新增原生图标配置。
- Harmony：优先复用当前 `.harmony.tsx` 与 Android 降级路径，避免新增未验证原生模块。

**安全与功能影响：**
- 不改变局域网服务、二维码、浏览器上传、文本提交、文件导入、文件保存或共享状态的数据流。
- UI 调整必须保留当前权限、错误提示、重试入口和危险操作确认。
- 验证范围必须覆盖 iOS、Android、Harmony 可用路径，以及局域网内容投递和文件保存流程。
