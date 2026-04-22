# local-transfer-server Specification

## Purpose
TBD - created by archiving change launch-fileflash-bridge-v1. Update Purpose after archive.
## Requirements
### Requirement: App SHALL manage a reachable local transfer service
系统 MUST允许用户在 React Native App 内显式启动和停止本地传输服务，并在服务运行期间展示当前可访问地址、端口、网络模式和二维码。服务必须同时考虑公共 Wi-Fi 与手机热点两种接入模式，并在地址变化时刷新展示结果。

#### Scenario: Provide HTTP-only access URL and QR code
- **WHEN** 服务进入可用状态
- **THEN** 系统 MUST仅提供基于 **HTTP** 的访问 URL（不提供 HTTPS），并生成与该 URL 等价的二维码供其他设备扫码打开浏览器门户页

#### Scenario: Start service on a shared Wi-Fi network
- **WHEN** 用户已授予必要权限并在连接公共 Wi-Fi 时点击启动服务
- **THEN** 系统 MUST启动本地传输服务并展示可由同一局域网设备访问的 URL 与二维码

#### Scenario: Refresh address after network mode changes
- **WHEN** 用户从公共 Wi-Fi 切换到手机热点或网络接口发生变化
- **THEN** 系统 MUST更新对外访问地址并提示用户旧地址已失效

#### Scenario: Stop service manually
- **WHEN** 用户点击停止服务
- **THEN** 系统 MUST立即终止新的外部连接并在界面中标记服务为已停止

### Requirement: Service SHALL remain reachable when app is backgrounded / screen is off
系统 MUST提供后台保活能力，确保在 App 切到后台或设备息屏后，本地传输服务仍保持可访问，直到用户显式停止服务。

平台约束：
- Android 侧必须采用前台服务（Foreground Service）或等价机制来保证后台可用性，并通过常驻通知告知用户服务运行中。
- iOS 侧必须采用平台允许的后台执行机制尽可能维持可用性，并在系统干预导致服务不可用时自动恢复或提示用户一键恢复。

#### Scenario: Access still works after screen lock
- **GIVEN** 用户已启动服务且服务处于运行中
- **WHEN** 用户锁屏/息屏或将 App 切到后台
- **THEN** 其他设备使用已展示的 URL/二维码访问门户页应仍然成功

#### Scenario: Service stays alive until user stops it
- **GIVEN** 服务处于运行中
- **WHEN** 用户未点击停止服务
- **THEN** 系统不得因为进入后台/息屏而主动停止服务

### Requirement: Service SHALL support simple mode and secure mode (URL key)
系统 MUST提供两种访问模式，且两种模式都基于 HTTP：
- **简单模式**：浏览器访问基础 URL 即可进入门户页。
- **安全模式**：浏览器访问 URL 必须携带 `key` 作为访问凭证；缺失或错误的 `key` 必须被视为未授权。

约束：
- `key` 必须由 App 生成；用户通过「刷新访问地址」时必须同时轮换 `key`，且旧 `key` 必须立即失效。
- 安全模式下，App 展示的“复制链接”和“二维码”必须包含 `key`。

#### Scenario: Access portal in simple mode
- **WHEN** 用户在 App 中选择“简单模式”并启动服务
- **THEN** 系统 MUST展示不包含 `key` 的 URL 与二维码，扫码或输入 URL 可直接打开门户页

#### Scenario: Access portal in secure mode
- **WHEN** 用户在 App 中选择“安全模式”并启动服务
- **THEN** 系统 MUST展示包含 `key` 的 URL 与二维码，且浏览器访问不带 `key` 的基础 URL 必须被拒绝或引导到未授权提示页

#### Scenario: Refresh address rotates key and invalidates old secure URLs
- **WHEN** 用户在服务运行中点击「刷新地址」
- **THEN** 系统 MUST重新探测网络并更新展示 URL，且必须生成新的 `key` 并更新 URL/二维码；此前所有使用旧 `key` 的访问必须失效

### Requirement: Service SHALL accept browser-originated files and text payloads
系统 MUST提供面向浏览器的入站投递接口，允许其他设备向手机上传文件、上传文件夹内容并提交文本内容。文件上传成功后必须写入**与本机 App 内当前传输会话绑定的内部存储**（按会话/项目隔离），**不得**在未经过用户在 App 内的**显式导出/保存**操作前，自动写入系统公共下载目录、相册或其它 App 外部可见位置。文本提交成功后必须进入手机端文本接收区，并与会话数据一并**持久化在本机**。

#### Scenario: Upload one or more files to the mobile device
- **WHEN** 浏览器用户选择一个或多个文件并发起上传
- **THEN** 系统 MUST接收文件内容、将其写入**会话关联的 App 内部存储**，并返回每个文件的处理结果

#### Scenario: Preserve directory structure during folder upload
- **WHEN** 浏览器支持目录上传且用户提交一个文件夹
- **THEN** 系统 MUST按相对路径保留目录结构并将内容写入**该会话的 App 内部存储**

### Requirement: Transfer data SHALL persist on the device
系统 MUST 确保文本项目、消息、会话关联的入站文件索引及文件内容必须**持久化保存在手机本机**（例如应用沙盒或受控存储），不得在 App 正常退出或进程重启后无故丢失；删除须由用户显式操作（如删除消息、删除会话或卸载 App）。

#### Scenario: Relaunch app retains sessions and received files
- **GIVEN** 用户曾接收文本与文件且未删除对应会话
- **WHEN** 用户关闭并重新打开 App
- **THEN** 会话列表、消息与关联入站文件仍必须可用（与实现一致的存储后端）

### Requirement: Inbound files SHALL be stored with lossless compression unless oversized
对入站保存的文件，系统 MUST采用**无损压缩或等价封装**（如将文件作为压缩包成员存储）以降低被其它组件误当作可直接执行内容处理的风险，并作为针对恶意投递的辅助措施。对**超过实现约定字节阈值**的文件，允许**跳过压缩**以控制耗时与资源占用；阈值必须可配置或文档化。

#### Scenario: Small file is stored using compression policy
- **WHEN** 浏览器上传的文件大小**低于**压缩跳过阈值
- **THEN** 系统 MUST按策略对其进行压缩封装存储（或等价处理），且必须能在 App 内完整还原原始字节供用户预览列表与导出

#### Scenario: Large file skips compression
- **WHEN** 浏览器上传的文件大小**达到或超过**压缩跳过阈值
- **THEN** 系统 MUST跳过压缩步骤，仍以会话内 App 内部存储保存，并不得因此自动导出到 App 外部

### Requirement: User MUST confirm session deletion when it removes session files
当用户删除**整个文本/传输会话（项目）**时，系统 MUST在删除前展示**不可忽略的确认**，明确告知：**删除将清除该会话下的数据及关联文件**；并提示用户**若需保留某些文件，请先进入该会话将其保存到外部**。用户确认后才可执行删除并回收存储。

#### Scenario: Delete session shows warning and requires confirmation
- **WHEN** 用户在手机端发起删除整个会话/项目
- **THEN** 系统 MUST展示包含上述含义的提示（文案可与产品一致，但不得省略「清除会话文件」与「可先进入会话保存」两层信息）
- **AND** 用户取消则不得删除任何数据

### Requirement: Explicit export path for files leaving the app
系统 MUST提供会话内的能力，使用户能够将已接收的单个或多个文件**显式保存/导出**到用户选择的外部位置（例如系统文件选择器、分享面板或平台等价能力）。**不得**将「浏览器上传成功」等同于「已写入用户相册/下载目录」。

#### Scenario: User exports a received file from within a session
- **WHEN** 用户在 App 内进入对应会话并对某入站文件执行「保存到…」或等价操作
- **THEN** 系统 MUST引导用户完成目标位置选择，并将解压/还原后的内容写入用户选定位置（在平台允许范围内）

#### Scenario: Submit pasted text content to the mobile device
- **WHEN** 浏览器用户在门户页粘贴文本并提交
- **THEN** 系统 MUST接收该文本内容并把它写入手机端文本接收区

#### Scenario: Browser text submits append to the current active project
- **GIVEN** App 已存在当前活跃的文本接收**项目**（会话），且该项目内已有至少一条由先前成功提交产生的**消息**
- **WHEN** 浏览器用户再次成功提交新的文本内容
- **THEN** 系统 MUST把新内容作为**同一项目内的新消息**追加，不得用新提交覆盖并丢弃该项目内既有消息（除非用户已显式删除对应消息或整个项目）

#### Scenario: New project starts the next sharing round
- **WHEN** 用户在 App 端**新建文本接收项目**并将其作为当前活跃项目
- **THEN** 后续浏览器成功提交的文本必须写入该新项目；此前项目及其下全部消息必须保留，直至用户删除

#### Scenario: Manage projects and messages in the text receive area
- **GIVEN** 文本接收区存在多个项目，且某项目内有多条浏览器提交消息
- **WHEN** 用户在手机端删除某一条消息、删除整个项目，或复制某一条消息
- **THEN** 系统 MUST仅影响用户选中的消息或项目，且不得破坏未选中的数据
- **AND** 必须支持用户对**任意一条消息**单独复制（不得仅以「当前项目中最后一次提交」为可复制对象）

### Requirement: App SHALL curate an outbound share list and service SHALL serve it for browser download
用户 MUST 仅在 App 内通过显式操作（例如文件选择/「加入共享」）将文件纳入**当前会话的共享列表**；系统不得向浏览器提供任意目录浏览或全盘文件列表。服务运行期间，浏览器门户必须能够通过同源 HTTP 接口获取**当前共享列表**（含可供展示的名称、大小、标识符等元数据），并对列表中的文件发起下载。

#### Scenario: No file is exposed until user adds it to the share list
- **WHEN** 用户尚未将任何文件加入当前共享列表
- **THEN** 浏览器门户的共享下载区必须不展示可下载文件，或展示明确的空态说明

#### Scenario: User adds files to the share list and browser can download
- **WHEN** 用户在 App 内将若干文件加入共享列表且传输服务处于运行中
- **THEN** 浏览器门户必须能够列出这些文件，并成功下载其内容到浏览器侧（例如保存为下载文件或 Blob）

### Requirement: Large shared files SHALL be transferred in chunks with bounded per-chunk retries on the client
对于超过实现所定义阈值的大文件，系统 MUST采用**分块**方式供浏览器拉取（例如基于字节范围 Range、分块序号接口或其它等价 HTTP 设计），以避免单次响应过大。浏览器门户必须对每个分块的请求在失败时自动重试；**同一分块在首次请求失败后，最多再重试 3 次**（即单分块至多 **4** 次传输尝试）。若某分块在用完上述尝试后仍失败，当前文件的下载必须**整体终止**，并向用户展示**传输失败**及可读原因（或错误分类）。

#### Scenario: Chunk exhausts retries and download fails
- **GIVEN** 浏览器正在分块下载某一共享文件
- **WHEN** 某一固定分块在连续 **4** 次尝试（含首次）后仍无法成功获取
- **THEN** 门户必须停止继续下载该文件，并提示传输失败；不得无限重试同一分块

#### Scenario: Successful chunked download of a large file
- **GIVEN** 用户共享了一个超过分块阈值的大文件
- **WHEN** 浏览器门户发起分块下载且各分块在重试策略内均成功
- **THEN** 用户必须能够获得完整文件内容，且门户应提供可理解的进度或分块完成反馈

### Requirement: Service MUST surface availability limits and failure states
系统 MUST在服务不可用、端口绑定失败、权限缺失、目录未授权或网络不满足访问条件时向用户明确提示原因，并提供至少一种恢复路径，例如重试、重新授权、刷新地址或返回系统设置。

#### Scenario: Start fails because permissions are missing
- **WHEN** 用户在未完成文件访问或本地网络权限授权时启动服务
- **THEN** 系统 MUST阻止服务进入可用状态并引导用户完成缺失权限

#### Scenario: Network is not reachable by peers
- **WHEN** 系统检测到当前网络模式无法向其他设备提供局域网访问
- **THEN** 系统 MUST提示用户切换到可用 Wi-Fi 或热点模式并禁止展示误导性的可访问地址

#### Scenario: App internal storage cannot complete write
- **WHEN** 浏览器发起上传但手机端 **App 内部会话存储**不可写、空间不足或保存失败
- **THEN** 系统 MUST向浏览器端和手机端同时返回明确的失败原因，并提示用户清理会话、导出后删除或释放空间后重试

### Requirement: App SHALL provide a project history sidebar using React Native Paper Drawer
系统 MUST 在主工作台中提供一个项目历史侧边栏，并使用 React Native Paper Drawer 组件体系展示项目列表与当前活跃项目状态。宽屏下侧边栏必须位于主内容左侧；窄屏下系统必须通过顶部菜单图标打开一个真正从左侧出现的 Drawer 式边栏，而不是把项目历史直接堆叠到主内容上方。窄屏 Drawer 必须在安全区域内展开，不得覆盖或改变状态栏。项目历史必须以列表行形式展示项目名称、创建日期和文件数等摘要，而不是卡片块；其表面、边框、间距、菜单和头部操作必须与新的 Paper 工作台主题保持一致，不得残留旧的浅黄色背景或旧式自定义卡片风格。侧边栏头部必须仅提供标题与右上角“新建”入口，不得出现额外关闭按钮或全局“删除当前项目”按钮。项目删除必须通过对应项目行尾部的 `...` 菜单触发，且侧边栏不得包含“启动服务”或“选文件”入口。

#### Scenario: View project history in the workspace sidebar
- **WHEN** 用户打开主工作台
- **THEN** 系统必须展示项目历史侧边栏，或在窄屏下允许用户打开左侧 Drawer 式边栏
- **AND** 系统必须在其中以列表行显示历史项目与当前活跃项目高亮态
- **AND** 窄屏下侧边栏外部入口必须是单个菜单图标按钮，侧边栏内部不得再出现关闭按钮

#### Scenario: Keep service and file import actions in the workspace home
- **WHEN** 用户查看项目历史侧边栏
- **THEN** 系统不得在其中展示“启动服务”或“选文件”操作
- **AND** 这些操作必须继续保留在主页工作区卡片中

#### Scenario: Create a new project from the sidebar
- **WHEN** 用户在项目历史侧边栏中执行新建项目
- **THEN** 系统必须创建新项目并将其设为当前活跃项目
- **AND** 工作台摘要、消息列表与文件列表必须立即切换到该项目

#### Scenario: Switch to a historical project from the drawer list
- **WHEN** 用户在 Drawer 项目列表中选中某个历史项目
- **THEN** 系统必须将该项目切换为当前活跃项目
- **AND** 侧边栏中的活跃态、顶部摘要、消息列表、文件列表和共享文件项目跳转都必须指向新的活跃项目

#### Scenario: Delete a project from the sidebar row menu
- **WHEN** 用户在某个项目行尾部打开 `...` 菜单并执行删除
- **THEN** 系统必须先展示现有的删除确认提示，明确说明会清除该项目数据及其关联文件
- **AND** 仅在用户确认后才可删除该项目
- **AND** 删除完成后系统必须刷新活跃项目状态与侧边栏项目列表

### Requirement: App SHALL present transfer operations through the refreshed Paper workspace
系统 MUST 在主工作台中通过新的 Paper 化界面承载服务启停、地址展示、文件导入、共享文件浏览、消息浏览、文件浏览、复制、导出与共享切换等核心操作。界面重构后，这些操作必须继续在共享代码中保持一致的信息架构和可发现性，不得因视觉升级而被隐藏、分散或弱化。

#### Scenario: Operate the service and file import from the refreshed home workspace
- **WHEN** 用户在主工作台首页查看服务控制区与文件导入区
- **THEN** 系统必须继续提供启动/停止服务、查看访问地址、复制链接和选择文件等操作，并以新的 Paper 主题和层级方式呈现

#### Scenario: Browse text and file content within the refreshed workspace
- **WHEN** 用户打开当前活跃项目并查看消息列表、文件列表或共享文件列表
- **THEN** 系统必须继续展示与现有功能等价的项目内容和操作入口，同时使这些列表在视觉上符合新的统一主题

#### Scenario: Preserve operational feedback after the UI refresh
- **WHEN** 文件上传完成、文本提交成功、共享切换失败、导出失败或权限/网络状态阻塞操作
- **THEN** 系统必须继续在 App 工作台中清晰提示结果、失败原因和后续可执行动作，而不得因为界面升级削弱反馈

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

