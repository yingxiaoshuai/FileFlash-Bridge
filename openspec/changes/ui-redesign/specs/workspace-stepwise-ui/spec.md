## ADDED Requirements

### Requirement: Workspace shall emphasize service startup before service is reachable

首页工作台 SHALL 在服务未运行或访问地址不可达时，把“启动服务”作为首屏中心主操作。

#### Scenario: Show centered startup action

- **WHEN** 用户打开首页且本地传输服务未运行
- **THEN** 系统 SHALL 在首屏中心展示启动服务主入口
- **AND** 该入口 SHALL 比共享列表、项目内容和其他工具操作更醒目
- **AND** 首页仍然 SHALL 是可操作工作台，而不是教程页或说明页

#### Scenario: Show startup busy feedback

- **WHEN** 用户触发启动服务且服务正在启动
- **THEN** 系统 SHALL 禁用重复触发
- **AND** 系统 SHALL 展示启动中、等待权限、网络检查或失败原因等反馈

#### Scenario: Do not show full inactive workspace before startup

- **WHEN** 服务尚未可达
- **THEN** 共享文件和项目内容 SHALL 以摘要、预览、折叠或隐藏状态呈现
- **AND** 不得以完整空白面板抢占启动入口的视觉焦点

### Requirement: Workspace shall reveal content and sharing after service startup

服务可达后，首页 SHALL 将“内容与共享工作区”作为主要工作区，并将服务控制压缩为摘要。

#### Scenario: Show full workspace when service is reachable

- **WHEN** 服务已运行且存在可访问地址或二维码
- **THEN** 系统 SHALL 展示地址摘要、二维码入口、复制链接、刷新地址、停止服务、共享文件区和项目内容区
- **AND** 内容与共享工作区 SHALL 成为页面主要视觉区域

#### Scenario: Collapse completed service step

- **WHEN** 用户已经完成服务启动
- **THEN** 系统 SHALL 将服务步骤压缩为包含在线状态、访问地址或连接状态的紧凑摘要
- **AND** 用户 SHALL 能从摘要继续执行复制链接、刷新地址、停止服务或查看二维码

### Requirement: Sharing and project content shall stay in one collaborative workspace

共享/导入、别人发送的文件、当前项目内容和共享管理 SHALL 保持在同一个工作区内协同呈现。

#### Scenario: Manage received files and shared files together

- **WHEN** 当前项目存在浏览器上传文件、浏览器提交文本、App 导入文件或历史项目内容
- **THEN** 系统 SHALL 在同一个内容与共享工作区展示这些内容
- **AND** 用户 SHALL 能继续执行加入共享、移出共享、导出保存、删除、复制文本和查看所属项目等操作

#### Scenario: Do not split import/share from project viewing

- **WHEN** 用户需要处理别人发送的文件并把它们共享给其他设备
- **THEN** 系统 SHALL 允许用户在同一工作区完成查看、共享切换和导出管理
- **AND** 系统不得要求用户切换到另一个独立步骤后才能完成协同操作

### Requirement: Responsive first-screen composition

首页 SHALL 在常见手机竖屏、横屏、窄屏和宽屏中保持首屏重点清晰，文本、二维码、图标按钮和底部 Tab 不重叠。

#### Scenario: Fit common mobile widths

- **WHEN** 首页在常见 iOS、Android 或 Harmony 手机宽度中渲染
- **THEN** 主操作、步骤标题、地址摘要、二维码、共享列表、项目内容和底部 Tab SHALL 保持可读且不互相覆盖

#### Scenario: Preserve operations after restructuring

- **WHEN** 页面从旧布局迁移到分步布局
- **THEN** 系统 SHALL 保留服务启停、地址复制、地址刷新、文件导入、媒体导入、批量下载、项目切换、项目重命名、项目删除、消息复制、文件导出和共享切换能力
