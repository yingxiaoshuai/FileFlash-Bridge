# workspace-visual-refresh Specification

## Purpose
TBD - created by archiving change refresh-paper-ui-apple-style. Update Purpose after archive.
## Requirements
### Requirement: App SHALL use React Native Paper as the primary workspace component system
系统 MUST 在 React Native App 主工作台中使用 React Native Paper 作为主要组件体系，统一承载按钮、图标按钮、菜单、列表项、表面容器、提示反馈和输入相关界面。若存在项目语义包装组件，这些包装组件也必须建立在 React Native Paper 组件和同一套主题 token 之上，而不得继续扩散彼此独立的自定义基础控件实现。

#### Scenario: Render workspace actions with the Paper component system
- **WHEN** 用户查看主工作台中的服务控制、项目历史、共享列表、消息列表或文件列表
- **THEN** 系统必须以 React Native Paper 组件或基于其主题能力的共享包装组件呈现这些操作与内容

#### Scenario: Keep interaction semantics stable while replacing components
- **WHEN** 工作台界面从旧的自定义基础控件迁移到 Paper 组件体系
- **THEN** 系统必须保持现有项目切换、服务启停、文件导入导出、共享切换、删除确认和文本复制等交互语义不变

### Requirement: Workspace SHALL provide an Apple-inspired neutral visual language
系统 MUST 为 App 主工作台和浏览器门户页提供统一的视觉主题，其整体风格应接近 Apple 风格的克制、轻盈和层次清晰的质感。该主题必须使用中性冷白、微灰或轻蓝灰作为背景与表面基底，不得继续以淡黄色作为主背景或大面积表面颜色；同时必须统一圆角、阴影、边框、文本层级和强调色规则。

#### Scenario: Remove pale yellow surfaces from the workspace
- **WHEN** 用户打开主工作台首页、项目历史侧边栏、消息列表、文件列表或浏览器门户页
- **THEN** 系统不得再以淡黄色作为主背景或主要表面色

#### Scenario: Preserve a clear visual hierarchy with restrained accents
- **WHEN** 用户在 App 或浏览器门户页中查看主要操作、次要操作、危险操作、空态和提示信息
- **THEN** 系统必须通过统一的表面层级、文本对比、圆角、阴影和有限的强调色建立清晰层次，而不得依赖杂乱的颜色堆叠

### Requirement: Browser portal SHALL align with the refreshed visual system
系统 MUST 让浏览器门户页与 App 主工作台在视觉语言上保持一致，包括背景基调、卡片层次、按钮状态、横幅反馈、列表项和空态说明。门户页无需直接使用 React Native Paper，但其 HTML/CSS 输出必须遵循同一套设计方向，不得保留旧的浅黄色纸面风格。

#### Scenario: Open the portal with the refreshed visual style
- **WHEN** 用户从浏览器访问手机端展示的传输地址
- **THEN** 系统必须返回符合新视觉系统的门户页，并在 hero、上传区、文本区和共享下载区中保持统一风格

#### Scenario: Keep portal feedback consistent with the app
- **WHEN** 门户页处于待上传、上传中、提交成功、下载中、失败或服务离线状态
- **THEN** 系统必须用与 App 一致的状态语义和高可读反馈样式展示这些状态

### Requirement: Workspace SHALL provide consistent feedback for operational states
系统 MUST 在工作台中以统一的视觉语言展示加载中、空态、成功、警告、错误和危险确认等操作状态，确保文件上传后的项目内容变化、文本提交后的消息列表变化、文件导出保存入口、共享切换结果和失败原因都能被明确感知。

#### Scenario: Show consistent feedback for empty, loading, and failure states
- **WHEN** 服务未启动、项目为空、共享列表为空、导出失败或网络不可达
- **THEN** 系统必须使用统一的反馈样式向用户说明当前状态和可执行的恢复动作

#### Scenario: Keep destructive actions clearly distinguishable
- **WHEN** 用户执行删除项目、删除消息、删除文件或移出共享等危险操作
- **THEN** 系统必须继续以明显区别于普通操作的视觉样式和确认流程展示这些动作

### Requirement: Workspace SHALL keep a consistent refreshed visual system across Home and Settings tabs
系统 MUST 在新增底部 Tab 壳层后，保持首页工作台、设置页和底部导航都遵循同一套刷新后的视觉系统。首页与设置页中的容器、列表项、图标按钮、菜单浮层和底部 Tab 状态 MUST 继续建立在统一的 React Native Paper 组件语义与主题 token 之上，而不是引入独立的第二套视觉语言。

#### Scenario: Render Home and Settings with the same visual system
- **WHEN** 用户在首页 Tab 与设置 Tab 之间切换
- **THEN** 系统 MUST 让两个页面保持一致的背景基调、表面层级、圆角、边框和交互反馈风格

#### Scenario: Keep the active tab state visually legible
- **WHEN** 用户查看底部 Tab 导航
- **THEN** 系统 MUST 通过统一的高亮状态、图标 / 文字颜色和可读对比度清晰区分当前激活页与未激活页

#### Scenario: Present the language settings item as part of the refreshed UI
- **WHEN** 用户在设置页查看或打开语言设置项
- **THEN** 系统 MUST 让语言图标、列表项、当前语言值和下拉菜单与现有刷新后的工作台风格保持一致，而不是出现与首页脱节的控件风格

### Requirement: Workspace SHALL present service startup as the first visual step
系统 MUST 在首页工作台中把“启动服务”呈现为局域网投递流程的第一视觉步骤。服务未运行时，首屏主区域 MUST 以居中的大圆形启动入口作为最醒目的主操作，并以简洁状态文案说明启动后才会显示浏览器入口、共享文件和项目内容。首页 MUST 仍然是可直接操作的功能界面，不得变成使用说明页、教程页或静态介绍页。该入口 MUST 使用现有 React Native Paper 主题语义或共享主题 token 实现，不得引入与当前工作台脱节的第二套视觉语言。

#### Scenario: Show centered startup entry before service runs
- **WHEN** 用户打开首页且本地传输服务未运行
- **THEN** 系统 MUST 在首屏中心展示大圆形“启动服务”入口
- **AND** 共享文件列表和项目内容列表不得以完整工作台形态抢占该主入口的视觉焦点
- **AND** 首页不得要求用户阅读说明或完成教程步骤后才能启动服务

#### Scenario: Show busy state while service is starting
- **WHEN** 用户点击大圆形启动入口且服务正在启动
- **THEN** 系统 MUST 将该入口呈现为不可重复触发的启动中状态
- **AND** 用户 MUST 能看到服务正在启动或等待权限/网络结果的反馈

#### Scenario: Preserve visual quality across screen sizes
- **WHEN** 首页在 iOS 或 Android 常见手机竖屏、横屏和平板宽屏中渲染
- **THEN** 大圆形启动入口、辅助提示、网络状态和访问模式控件 MUST 保持可读、可点击且不互相重叠

#### Scenario: Keep the home screen functional rather than instructional
- **WHEN** 用户打开服务未运行的首页
- **THEN** 首屏 MUST 以真实启动操作、当前网络/模式状态和必要错误反馈为核心
- **AND** 不得以大段使用说明、功能介绍卡片或静态教程替代真实操作控件

### Requirement: Workspace SHALL reveal sharing and project content after service startup
系统 MUST 在服务进入可访问状态后展开完整共享工作台，包括访问地址、二维码、共享文件区和当前项目内容区。展开后的布局 MUST 形成“启动服务 → 管理共享文件 → 查看项目内容”的清晰操作顺序，并继续遵循刷新后的中性视觉系统、表面层级、按钮状态和反馈样式。

#### Scenario: Reveal full workspace when service is reachable
- **WHEN** 服务已运行且系统已生成可达访问地址
- **THEN** 首页 MUST 展示访问地址、二维码、复制链接、刷新地址、停止服务、共享文件区和当前项目内容区
- **AND** 这些区域 MUST 按步骤顺序或等价视觉层级组织，而不是回到无主次的同屏堆叠

#### Scenario: Keep existing project data after startup
- **GIVEN** 当前会话已有共享文件、已接收文本或已接收文件
- **WHEN** 用户启动服务并进入完整工作台
- **THEN** 系统 MUST 展示既有共享文件和当前项目内容
- **AND** 不得因为步骤式布局切换而清空、隐藏或重置这些数据

#### Scenario: Preserve refreshed visual consistency
- **WHEN** 用户在启动前、启动中、运行中和启动失败状态之间切换
- **THEN** 首页 MUST 保持统一的背景、表面、圆角、阴影、文字层级和强调色规则
- **AND** 不得出现旧样式按钮、杂乱颜色堆叠或与 Paper 工作台脱节的控件

### Requirement: Workspace SHALL present a stepwise primary transfer flow
移动端首页工作台 MUST 以分步主流程组织核心传输能力，至少包含“启动服务”和“内容与共享工作区”两个阶段。步骤顺序 MUST 帮助用户理解先启动局域网服务，再在同一个内容工作区中处理共享/导入、别人发送的文件、项目内容查看、加入共享、导出保存和删除管理；系统不得把共享/导入与项目查看拆成互相隔离的步骤，也不得继续把所有完整功能区无层级地堆叠在同一首屏。

#### Scenario: First step is emphasized before service is reachable
- **WHEN** 用户打开首页且本地传输服务未运行，或当前没有可被其他设备访问的地址
- **THEN** 系统 MUST 将“启动服务”作为当前主步骤展示
- **AND** 系统 MUST 将启动/重试服务入口作为当前最显著的主操作
- **AND** 内容与共享工作区不得以完整面板抢占首屏主焦点

#### Scenario: Content and sharing workspace becomes primary after service is reachable
- **WHEN** 服务已运行且存在可访问地址或二维码
- **THEN** 系统 MUST 将“内容与共享工作区”作为下一步主要工作区展示
- **AND** 系统 MUST 在该工作区中同时提供导入文件、导入媒体、查看共享列表、查看当前项目内容和浏览器访问入口相关信息
- **AND** 当前访问地址、复制链接、刷新地址和二维码 MUST 继续可发现

#### Scenario: Received files can be managed and shared in the same workspace
- **WHEN** 当前项目存在浏览器提交文本、浏览器上传文件、App 导入文件或历史项目内容
- **THEN** 系统 MUST 在同一个内容与共享工作区中展示文本消息、项目文件、共享文件状态和相关操作
- **AND** 用户 MUST 能对别人发送的文件或 App 导入的文件继续执行加入共享、移出共享、导出保存、删除和查看所属项目等操作
- **AND** 系统不得要求用户切换到另一个独立步骤后才能完成这些协同操作

### Requirement: Workspace SHALL show only the necessary detail for each step
移动端首页工作台 MUST 让当前阶段承载主要视觉重量，并把已完成或暂不可用内容压缩为摘要、预览或折叠状态。系统 MUST 避免在同一屏同时完整展开服务控制、二维码、共享列表、项目列表、项目详情和所有操作按钮；但内容查看与共享操作 MUST 保持在同一个工作区中协同呈现。

#### Scenario: Completed steps collapse to summaries
- **WHEN** 用户已经完成服务启动并进入内容与共享工作区
- **THEN** 系统 MUST 将服务步骤压缩为包含在线状态、连接数、访问模式或地址摘要的紧凑区域
- **AND** 用户 MUST 能从该摘要重新执行复制链接、刷新地址、停止服务或查看二维码等相关操作

#### Scenario: Unavailable steps do not appear as full empty panels
- **WHEN** 某一步骤尚未满足前置条件，例如服务未启动、没有共享文件或当前项目为空
- **THEN** 系统 MUST 以轻量预览、空态或禁用状态说明该步骤
- **AND** 系统 MUST 不得展示大量不可执行按钮或完整空白面板来制造廉价感

#### Scenario: Existing operations remain reachable after restructuring
- **WHEN** 用户进入内容与共享工作区
- **THEN** 系统 MUST 保留现有服务启停、地址复制、地址刷新、文件导入、媒体导入、批量下载、项目切换、项目重命名、项目删除、消息复制、文件导出和共享切换能力
- **AND** 文件导入、收到文件、项目查看和共享切换 MUST 处于同一个工作区语境中

### Requirement: Workspace actions SHALL prefer icon-first controls with accessible meaning
移动端工作台中的高频工具操作 MUST 优先使用图标或图标加极短标签呈现，减少冗长按钮文字。所有图标化操作 MUST 保留明确的可访问名称、稳定测试标识和足够触控面积；关键、危险或不可逆动作 MUST 保留必要文字确认。

#### Scenario: High-frequency utility actions use icons
- **WHEN** 用户查看访问地址、共享文件列表、项目内容、项目历史或顶部工具区
- **THEN** 复制链接、刷新地址、导入文件、导入媒体、加入/移出共享、选择下载、清空选择、打开更多菜单、语言切换和帮助入口 MUST 优先以图标化控件呈现
- **AND** 这些控件 MUST 使用统一图标风格和触控尺寸

#### Scenario: Icon buttons remain understandable and accessible
- **WHEN** 用户通过屏幕阅读器、自动化测试或视觉扫描识别图标按钮
- **THEN** 每个图标按钮 MUST 提供清晰的 `accessibilityLabel` 或等价可访问名称
- **AND** 每个关键图标按钮 MUST 保留稳定 `testID`

#### Scenario: Destructive and primary commit actions keep explicit confirmation
- **WHEN** 用户删除项目、删除文件、删除消息、停止服务或发起批量导出/保存
- **THEN** 系统 MUST 保留明确文字、确认流程或结果反馈
- **AND** 系统不得仅用无说明图标执行危险或不可逆操作

### Requirement: Workspace SHALL present a premium visual hierarchy across iOS and Android
移动端工作台 MUST 使用更克制、更高级的视觉层级呈现分步流程和内容与共享工作区，包括中性背景、稳定留白、清晰焦点态、统一表面层级和一致图标语言。系统 MUST 避免大面积单一色块、重复嵌套卡片、装饰性背景元素、过多文字说明和同质化按钮堆叠。

#### Scenario: Step layout feels cohesive across Home and Settings
- **WHEN** 用户在首页、设置页、底部 Tab 和工作台引导之间切换
- **THEN** 系统 MUST 保持统一背景基调、表面层级、边框、圆角、图标风格和状态反馈
- **AND** 首页分步工作流不得引入与设置页或底部导航脱节的第二套视觉语言

#### Scenario: Common phone widths do not produce crowded or overlapping content
- **WHEN** 工作台在 iOS 与 Android 常见手机竖屏、窄屏和较宽屏设备上展示
- **THEN** 步骤标题、图标按钮、二维码、访问地址、列表项和底部 Tab MUST 不发生文字溢出、按钮挤压或内容重叠
- **AND** 图标按钮 MUST 位于安全区内并保持可点击

#### Scenario: Operational feedback remains visible in the step context
- **WHEN** 服务启动失败、网络不可达、文件导入失败、文本提交完成、文件导出失败或共享状态变化
- **THEN** 系统 MUST 在当前步骤附近或统一反馈区域展示结果、原因和可执行恢复动作
- **AND** 更克制的视觉风格不得削弱错误、警告和成功状态的可感知性

