## ADDED Requirements

### Requirement: Workspace SHALL present a compact top-level status summary
系统 MUST 在移动端主工作台中，将“连接 / 共享 / 模式”等短状态以紧凑摘要项呈现，并优化首屏内容密度。移动端主工作台必须在“工作台”标题下方以紧凑摘要项展示当前活跃连接数、共享文件数和当前访问模式，不得继续使用三个独立的大尺寸状态卡片承载这些短状态。该摘要区必须保持可快速扫读，并把更多首屏高度让给服务控制区和共享文件区。iOS 与 Android 可以在安全区留白和触控反馈上存在细微差异，但信息层级必须保持一致。

#### Scenario: Show compact status summary on workspace open
- **WHEN** 用户打开主工作台
- **THEN** 系统必须在标题附近以紧凑摘要项展示“连接 / 共享 / 模式”三个状态
- **AND** 这三个状态不得再以独立的大尺寸卡片形式占据首屏主体区域

#### Scenario: Preserve shared file visibility in the first screen
- **GIVEN** 用户处于常见手机竖屏工作台布局，且当前项目存在共享文件或共享文件空态
- **WHEN** 工作台完成渲染
- **THEN** 系统必须在首屏中同时展示服务控制区与共享文件区入口
- **AND** 用户无需先滚过整排状态卡片才可看到共享文件区的标题或列表起始内容

### Requirement: Service controls SHALL stay contextual to the current access address
系统 MUST 将访问地址与其上下文操作在同一区域呈现，避免脱离地址语境的一级大按钮。工作台中的服务控制区必须将访问地址与其相关操作并置展示。服务可用时，系统必须在地址行附近提供复制链接和刷新地址等紧凑操作；服务未启动或当前没有可达地址时，系统必须隐藏或禁用这些无效操作，并将地址区压缩为单行停止态说明。服务在线/离线状态必须通过服务标题区与启动/停止主按钮统一表达，避免在同一首屏中重复出现多个“未启动”状态块。网络诊断提示和访问模式控制必须仍然可发现，但应作为次级状态项呈现；只有在存在需要立即处理的异常时，才允许升级为更强提示。

#### Scenario: Show address actions next to a reachable address
- **WHEN** 服务进入可用状态并生成可访问地址
- **THEN** 系统必须在地址展示区附近提供复制链接和刷新地址操作
- **AND** 这些操作必须与当前地址处于同一上下文区域，而不是作为远离地址的一级大按钮单独出现

#### Scenario: Collapse stopped-state address area
- **WHEN** 服务未启动、已停止或当前网络不可生成可达地址
- **THEN** 系统必须隐藏或禁用复制链接和刷新地址等无效操作
- **AND** 地址区必须压缩为简洁的停止态或不可达说明，不得继续占用多行冗余空间

#### Scenario: Surface network issues without misleading availability
- **WHEN** 系统检测到“无可用局域网”或其它导致外部设备不可访问的网络状态
- **THEN** 工作台必须继续提供可发现的网络诊断提示或说明入口
- **AND** 系统不得展示误导性的可复制访问地址
- **AND** 在不存在立即阻断性错误时，网络诊断不应长期占用独立整行横幅
