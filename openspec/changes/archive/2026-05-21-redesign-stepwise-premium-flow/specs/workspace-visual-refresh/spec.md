## ADDED Requirements

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
