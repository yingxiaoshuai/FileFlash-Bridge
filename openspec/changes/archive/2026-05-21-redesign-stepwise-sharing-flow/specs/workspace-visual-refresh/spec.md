## ADDED Requirements

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
