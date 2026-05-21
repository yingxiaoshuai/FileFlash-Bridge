# web-transfer-portal Specification

## Purpose
TBD - created by archiving change launch-fileflash-bridge-v1. Update Purpose after archive.
## Requirements
### Requirement: Browser portal SHALL present a responsive transfer workspace
系统 MUST 提供一个可由桌面和移动浏览器访问的响应式页面，展示当前设备名称、连接状态、文件上传区、**手机端已共享文件的下载区**、文本粘贴区和主要操作入口。页面必须在无需安装任何客户端的前提下完成向手机投递文件、从手机取回已共享文件、以及提交文本内容的核心流程。门户页的整体视觉风格必须与 App 主工作台保持一致，采用中性冷白或微灰的背景与表面基底、清晰的区块层级、统一的按钮和反馈样式，不得继续使用旧的浅黄色纸面风格。

#### Scenario: Open portal from desktop browser
- **WHEN** 用户在电脑浏览器中访问 App 展示的局域网地址
- **THEN** 系统必须返回可正常渲染的门户页面，并显示设备信息、文件上传区、共享文件下载区和文本提交区
- **AND** 页面必须以新的统一视觉主题呈现 hero、内容卡片和主要操作

#### Scenario: Open portal from mobile browser
- **WHEN** 用户在另一台手机或平板浏览器中访问该地址
- **THEN** 页面必须根据窄屏布局调整操作区，仍可完成文件上传、共享文件下载与文本内容投递
- **AND** 页面在窄屏下仍必须保持与 App 一致的视觉层级和状态反馈样式

### Requirement: Browser portal SHALL support uploading files to the mobile device
系统 MUST允许浏览器用户通过点击选择或拖拽方式上传文件，并在浏览器支持目录上传时允许上传文件夹。上传过程必须展示实时进度、成功状态和失败原因；上传后的内容必须由手机端写入 **App 内与会话绑定的内部存储**，不得误导用户以为已自动进入系统公共目录。

#### Scenario: Upload one or more files successfully
- **WHEN** 浏览器用户选择多个文件并确认上传
- **THEN** 系统 MUST展示每个文件的上传进度，并在完成后提示手机端已接收
- **AND** 成功提示不得声称文件已自动进入对方手机的系统「下载」或相册；应传达为保存在 **FileFlash-Bridge App 内会话**（或与产品名一致的表述），具体外部保存由手机用户在 App 内操作

#### Scenario: Upload a directory in a supported browser
- **WHEN** 浏览器支持目录上传且用户选择一个文件夹上传
- **THEN** 系统 MUST保留该文件夹的相对结构并将内容写入手机端 **App 内会话存储**

#### Scenario: Upload fails during transfer
- **WHEN** 上传因网络中断、空间不足或权限异常而失败
- **THEN** 页面必须提示失败原因，并允许用户重新发起上传

### Requirement: Browser portal SHALL support submitting pasted text content to the mobile device
系统 MUST允许浏览器用户在门户页中粘贴或输入文本内容并提交给手机。文本提交成功后，页面必须明确提示手机端已接收；若提交内容为空、超出限制或服务不可用，页面必须阻止或提示失败原因。

#### Scenario: Submit text content successfully
- **WHEN** 浏览器用户在文本区域粘贴内容并点击提交
- **THEN** 页面必须提示提交成功，并告知文本已发送到手机端接收区（由 App 侧**当前活跃文本项目**收纳，具体会话划分由手机端管理，浏览器无需选择项目）

#### Scenario: Block empty text submission
- **WHEN** 浏览器用户未输入任何文本即尝试提交
- **THEN** 页面必须阻止提交并提示需要先输入或粘贴内容

### Requirement: Browser portal MUST keep transfer feedback understandable
系统 MUST在等待用户操作、上传中、文本提交中、服务停止和认证失败等状态下提供明确的用户提示，不得让浏览器用户处于无反馈状态。

#### Scenario: Portal is ready for incoming content
- **WHEN** 浏览器门户成功加载但用户尚未选择文件或输入文本
- **THEN** 页面必须展示清晰的空闲态提示，引导用户上传文件、从共享列表下载（若有）或粘贴文本

#### Scenario: Service stops while portal is open
- **WHEN** App 端停止服务或服务被系统中断
- **THEN** 页面必须提示连接已断开，并提示用户等待服务恢复后重试

### Requirement: Browser portal SHALL download shared files using chunks and bounded per-chunk retries
系统 MUST 确保：当手机端存在共享文件时，门户必须允许用户发起下载。对于大文件，下载必须采用**分块**请求组装完整文件。每个分块请求失败时门户必须自动重试；**同一分块在首次失败后最多再重试 3 次**（单分块至多 **4** 次尝试）。若某分块用尽重试仍失败，必须中止该文件的下载并明确提示**传输失败**。

#### Scenario: User downloads a shared file successfully
- **WHEN** 共享列表中存在可下载文件且用户触发下载
- **THEN** 页面必须展示下载进度或分块推进反馈（实现可简化），并在成功结束后提供可保存的完整文件结果

#### Scenario: Per-chunk retries exhausted
- **WHEN** 某一文件分块在 **4** 次尝试内均失败
- **THEN** 页面必须停止该文件下载并提示传输失败，不得对同一分块无限重试

### Requirement: Browser portal MUST provide Apple-inspired transfer feedback
系统 MUST 在门户页中以与 App 主工作台一致的视觉语言展示等待上传、上传中、文本提交中、下载中、成功、警告、错误和离线等状态，使浏览器用户在每个传输阶段都能获得清晰反馈。该反馈必须通过统一的横幅、状态卡片、列表状态或等价 UI 结构呈现。

#### Scenario: Portal is ready for incoming content
- **WHEN** 浏览器门户成功加载但用户尚未选择文件或输入文本
- **THEN** 页面必须展示清晰的空闲态提示，引导用户上传文件、从共享列表下载或粘贴文本
- **AND** 这些空闲态提示必须符合新的统一视觉风格

#### Scenario: Show consistent visual feedback during transfer
- **WHEN** 浏览器用户上传文件、提交文本、下载共享文件或遇到连接失败
- **THEN** 页面必须通过统一的状态样式展示当前进度、成功结果或失败原因，而不得出现旧样式与新样式混用的情况

### Requirement: Browser portal SHALL upload large files without oversized JS binary objects
浏览器门户 MUST 使用有界分片上传大文件，并避免在门户脚本中把大文件或过大的文件分片展开为可枚举的超大 `Uint8Array` 对象。上传流程 MUST 持续展示每个文件的进度、成功状态和失败原因；当底层服务失败时，页面 MUST 中止任务并允许用户重试。

#### Scenario: Upload progress advances on Harmony
- **WHEN** 浏览器用户通过门户页向鸿蒙设备上传大文件
- **THEN** 页面 MUST 以有界分片提交文件内容
- **AND** 上传进度 MUST 随已确认发送或已确认保存的字节数推进
- **AND** 页面 MUST NOT 长时间停留在待上传、上传中 0% 或无响应状态

#### Scenario: Upload fails with a clear reason
- **WHEN** 上传过程中本地服务返回 4xx/5xx、网络断开、请求超时或 Harmony runtime 返回二进制桥接错误
- **THEN** 页面 MUST 停止该文件上传并显示可理解的失败提示
- **AND** 页面 MUST 清理当前上传任务状态，使用户可以重新选择或重新上传文件

#### Scenario: Upload keeps binary transfer byte-oriented
- **WHEN** 门户页准备上传文件分片
- **THEN** 页面 MUST 使用 Blob、ArrayBuffer、`Uint8Array` 或平台等价字节结构提交二进制内容
- **AND** 页面 MUST NOT 使用 base64 字符串表示大文件分片

### Requirement: Browser portal SHALL download shared files with bounded memory
浏览器门户 MUST 以有界内存下载共享文件。对于大文件，页面 MUST 避免一次性创建完整分片计划、保存所有下载分片、或在下载完成前把整文件放入超大 JS 数组；页面 MUST 按已完成字节数持续更新进度，并在失败时明确结束任务。

#### Scenario: Download large shared file on Harmony
- **WHEN** 用户在浏览器门户中点击下载鸿蒙设备共享的大文件
- **THEN** 页面 MUST 按 range、part、stream 或等价机制逐步获取文件内容
- **AND** 下载进度 MUST 在成功收到分块后持续推进
- **AND** 页面 MUST NOT 因等待完整分片数组或一次性 Blob 合成而停留在下载中 0%

#### Scenario: Download avoids unbounded chunk arrays
- **WHEN** 共享文件大小需要多个分块才能完成下载
- **THEN** 页面 MUST 只保留当前实现所需的有限分块状态
- **AND** 页面 MUST NOT 为完整文件维护超大 `downloadedChunks` 数组、超大 `chunkProgressByIndex` 数组或等价无界对象集合

#### Scenario: Download failure is recoverable
- **WHEN** 某个下载分块重试耗尽、服务停止、浏览器保存能力不可用或 Harmony runtime 返回二进制桥接错误
- **THEN** 页面 MUST 中止当前文件下载并显示失败原因
- **AND** 下载按钮 MUST 恢复到可重新发起的状态
- **AND** 页面 MUST NOT 让失败任务阻塞其它共享文件下载或后续上传

### Requirement: Browser portal SHALL time out stalled transfer requests
浏览器门户 MUST 为上传、下载和共享列表刷新设置可控的超时、取消和状态清理机制。页面 MUST NOT 在底层请求已经不可达、App 服务异常或浏览器网络断开后永久显示进行中状态。

#### Scenario: Transfer request stalls
- **WHEN** 上传或下载请求在实现定义的超时时间内没有收到进度、响应头或失败状态
- **THEN** 页面 MUST 取消该请求并提示传输超时或服务不可用
- **AND** 页面 MUST 将对应任务从进行中状态恢复为可重试状态

#### Scenario: Service becomes unavailable while portal is open
- **WHEN** 本地传输服务停止、App 崩溃或浏览器无法继续访问当前局域网地址
- **THEN** 页面 MUST 展示服务不可用状态
- **AND** 页面 MUST NOT 继续显示正在上传或正在下载的成功预期

### Requirement: Browser portal SHALL support batch selecting shared files for download
浏览器门户的共享下载区 MUST 支持批量选择下载。用户 MUST 能选择多个手机端共享文件、全选、清空选择，并通过“下载选中”批量发起下载。批量下载 MUST 复用单文件下载路径和大文件分块策略，不得新增 base64 二进制传递路径。

#### Scenario: User selects files in the browser portal
- **WHEN** 浏览器门户展示一个或多个手机共享文件
- **THEN** 页面 MUST 提供批量选择入口
- **AND** 用户 MUST 能选择或取消选择单个文件
- **AND** 页面 MUST 显示已选择文件数量

#### Scenario: User downloads selected shared files
- **WHEN** 浏览器用户选择多个共享文件并触发下载选中
- **THEN** 页面 MUST 对选中文件逐个或以受控并发发起下载
- **AND** 每个文件 MUST 继续使用单文件下载状态、进度、失败重试和大文件分块规则
- **AND** 某个文件失败时页面 MUST 标记该文件失败，并允许其它选中文件继续或明确中止策略

#### Scenario: User starts batch download without selection
- **WHEN** 浏览器用户没有选择任何共享文件即触发下载选中
- **THEN** 页面 MUST 阻止批量下载
- **AND** 页面 MUST 提示用户先选择要下载的文件

### Requirement: Browser portal SHALL use clear upload and download wording
浏览器门户 MUST 使用清晰文案区分文件流向：上传区表示“上传到手机”，共享区表示“从手机下载”或等价含义，批量操作表示“下载选中”。页面 MUST NOT 使用容易让用户误解文件已自动保存到手机公共目录或浏览器已完成保存的表述。

#### Scenario: Portal displays shared download copy
- **WHEN** 浏览器用户打开门户并查看共享下载区
- **THEN** 页面 MUST 以清晰标题或操作文案表达这些文件来自手机端共享列表，可被浏览器下载
- **AND** 单文件下载、批量选择、下载选中、失败和完成状态 MUST 使用一致的下载语义

