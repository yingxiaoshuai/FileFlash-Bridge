## Context

FileFlash-Bridge 是 React Native + TypeScript 跨平台应用，核心价值是让手机成为局域网内的轻量接收端。当前 App 已经使用 React Native Paper、`theme.ts`、`paperTheme.ts`、`ui.tsx`、`appShellStyles.ts`、`HomeScreen`、`SettingsScreen`、`AppBottomTabBar` 和项目本地图标抽象 `AppIcons*.tsx`。

这次设计文档修正后，目标不是把应用改造成依赖 iOS 专属库的界面，而是在现有共享代码基础上做一个更有层级、更顺手、更稳的跨平台工作台。

约束：
- 共享 React Native 层优先；只有平台能力差异明确时才走平台文件或降级。
- 不新增不存在或未验证的原生 UI 依赖。
- Harmony 必须有可运行降级方案。
- 不改变浏览器向手机投递文件/文本的服务模型。
- 共享/导入与项目查看必须保持在同一工作区。
- UI 改造必须减少首屏拥挤感，避免大面积单一蓝色、重复卡片、冗长文字和廉价按钮堆叠。

## Goals / Non-Goals

**Goals:**
- 将首页整理为“启动服务 -> 内容与共享工作区”的分步视觉流程。
- 服务未启动时，把启动服务放在首屏中心，其他内容压缩为预览或隐藏。
- 服务启动后，把服务信息压缩为摘要，让内容与共享工作区成为主视觉区域。
- 建立跨平台高级设计 token，统一背景、表面、状态色、圆角、阴影、间距和文字层级。
- 高频工具操作优先使用图标，保留可访问标签、测试标识和危险操作确认。
- 保持首页、设置页、底部 Tab、引导层和反馈横幅同一视觉系统。
- 用轻量动效增强按压、切换和面板出现，不影响低端设备和 Harmony。

**Non-Goals:**
- 不改变局域网服务、上传协议、文件保存、共享状态或项目数据模型。
- 不把共享/导入和项目查看拆成不同主页面。
- 不引入 `react-native-sf-symbols`、BlurView 或 Reanimated 作为 V1 必需项。
- 不实现完整自定义主题编辑器。
- 不把首页变成教程页、营销页或纯说明页。

## Decisions

### 1. 共享层设计系统

**决策：** 在 `src/app/colors.ts` 和 `src/app/tokens.ts` 中补充语义化 token，并由 `theme.ts`、`paperTheme.ts` 集成。

**理由：**
- 当前样式集中在 `theme.ts` 和 `appShellStyles.ts`，继续沿用可降低改造风险。
- 语义化 token 能让 Home、Settings、BottomTab、Feedback、Panel 共享同一规则。
- Android/Harmony 可通过同一 token 获得稳定降级，不依赖 iOS 专属能力。

**实现方向：**
```typescript
export const colors = {
  accent: '#1473E6',
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF3F8',
  label: '#101828',
  secondaryLabel: '#667085',
  success: '#2F9E67',
  warning: '#D9822B',
  danger: '#D64545',
};

export const tokens = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  iconSize: { sm: 16, md: 20, lg: 24 },
};
```

### 2. 项目本地图标体系

**决策：** 复用并扩展 `src/app/icons/AppIcons*.tsx`，不用外部 SF Symbols 或 Material Icons 原生包。

**理由：**
- `react-native-sf-symbols` 在 npm 官方 registry 不存在，不能作为任务依赖。
- 项目已经有跨平台图标抽象，Android/Harmony 也已有平台文件。
- 本地图标可控、可测、可降级，不会给 Harmony 带来新原生模块风险。

**图标策略：**
- iOS/default：优先使用 `react-native-svg` 绘制线性图标。
- Android/Harmony：复用现有平台降级；必要时新增项目本地 mask PNG 或共享 SVG。
- 高频操作统一尺寸：16、20、24。
- 所有图标按钮必须保留 `accessibilityLabel` 与稳定 `testID`。
- 危险操作和最终提交动作不能只用图标，必须保留确认或明确文字。

### 3. 首页分步工作流

**决策：** 首页根据服务可达状态切换主视觉重心。

**服务未启动：**
- 首屏中心显示启动服务大入口。
- 同屏只保留必要网络状态、访问模式、安全模式和失败/重试反馈。
- 共享文件与项目内容不完整展开，避免抢视觉焦点。

**服务已启动：**
- 服务控制压缩为在线摘要，保留复制链接、刷新地址、停止服务、二维码查看。
- 内容与共享工作区成为主区域。
- 工作区内同时展示共享文件、收到的文本/文件、App 导入文件、项目内容和相关操作。

**理由：**
- 用户真实路径是先启动服务，再处理内容。
- 共享/导入与项目查看是协同关系，不能拆开。
- 完整功能都保留，但每一步只显示当前最重要的内容。

### 4. 跨平台“材质感”而非原生 Blur 依赖

**决策：** V1 使用半透明表面、边框、阴影、层级和高光线模拟高级材质感；不强制引入 `@react-native-community/blur`。

**理由：**
- BlurView 在 Android/Harmony 的性能和兼容性不确定。
- 当前视觉问题主要来自层级拥挤和样式不统一，不需要先上原生 blur。
- 轻量表面更容易测试和回滚。

**实现方向：**
- `PanelSurface` 使用语义表面色、统一阴影、边框、高光线。
- 底部 Tab 和顶部区域使用轻量 translucent surface。
- 同屏不嵌套多层卡片，避免廉价堆叠。

### 5. 轻量动效

**决策：** V1 使用 React Native `Animated` 或 Paper 内置反馈实现按压缩放、面板淡入/位移和状态切换过渡；不强制引入 `react-native-reanimated`。

**理由：**
- 当前需要的是克制的原生感反馈，不是复杂手势动画。
- `Animated` 能满足 `useNativeDriver: true` 的基础动效。
- 少依赖更适合 Android/Harmony 兼容。

**应用场景：**
- 启动服务入口按压反馈。
- 服务启动成功后，内容工作区淡入。
- 项目历史抽屉、重命名弹窗、引导层保持平滑出现。

### 6. 数据流保持不变

**决策：** UI 重排只改变展示层，不改变业务流。

**文件上传：**
- 浏览器上传仍由本地传输服务接收并写入当前项目。
- 上传成功后项目文件列表和共享状态按现有模型更新。

**文本提交：**
- 浏览器文本仍进入当前项目消息列表。
- UI 只改变消息卡片层级和操作入口。

**文件保存/共享：**
- 收到的文件和 App 导入文件仍可加入共享、移出共享、导出保存和删除。
- 批量选择、下载和清空选择入口保持可发现。

**异常与重试：**
- 网络不可达、服务启动失败、文件导入失败、导出失败、共享切换失败必须显示在当前步骤附近或统一反馈区。
- 错误反馈需要说明原因和下一步动作。

## Risks / Trade-offs

### 1. 不使用真实 SF Symbols

**权衡：** iOS 原生感不如系统 SF Symbols，但项目可安装性、Android/Harmony 兼容性和交付稳定性更重要。

**缓解：** 本地图标保持线性、统一 stroke、统一尺寸；未来如确认可用包或自研 Native Module，再单独提案。

### 2. 不使用真实 BlurView

**权衡：** 毛玻璃真实度降低，但避免 Android/Harmony 性能和构建风险。

**缓解：** 用表面层级、透明度、边框和阴影提升质感；只在明确验证后再引入原生 blur。

### 3. 分步界面可能隐藏部分操作

**风险：** 用户启动服务前可能找不到历史项目或共享列表。

**缓解：** 服务未启动时允许轻量预览或摘要；服务启动后完整恢复所有操作；历史项目入口保持可发现但不抢主焦点。

### 4. 现有测试可能依赖文字按钮

**风险：** 图标化后测试找不到原按钮文本。

**缓解：** 保留稳定 `testID` 和 `accessibilityLabel`，必要时更新测试按语义查询。

## Migration Plan

### 阶段 1：文档和基线
1. 修正 OpenSpec 文档，移除不存在或不适配依赖。
2. 跑 `npm run typecheck` 和 `npm run test:unit -- --runInBand` 建立基线。

### 阶段 2：设计系统和图标
1. 添加 `colors.ts`、`tokens.ts`，更新 `theme.ts` 与 `paperTheme.ts`。
2. 扩展项目本地图标组件，替换高频文字符号。
3. 更新 `ActionButton`、`PanelSurface`、`GlyphIconButton`。

### 阶段 3：首页分步结构
1. 服务未启动时居中启动入口。
2. 服务已启动时收起服务摘要，突出内容与共享工作区。
3. 保留共享文件、项目内容、收到文件和导入文件的协同操作。

### 阶段 4：设置页、底部 Tab 和引导层统一
1. 设置页改为同一视觉 token。
2. 底部 Tab 改为轻量高质感样式。
3. 引导层锚点跟随新的分步结构。

### 阶段 5：验证和回滚
1. 跑类型检查和单元测试。
2. 验证局域网投递、文本提交、文件导入、文件导出、共享切换。
3. 在 iOS/Android/Harmony 可用设备上进行真机检查。
4. 保留旧主题备份或 feature flag，出现严重问题可回滚。

## Open Questions

1. 后续是否需要单独引入真实 iOS SF Symbols Native Module？
2. 后续是否需要在 iOS 单独启用 BlurView，并为 Android/Harmony 保持降级？
3. 图标化后哪些危险操作必须继续显示文字按钮？
4. Harmony 上是否继续使用 PNG mask 作为图标主降级，还是统一迁回 SVG？
