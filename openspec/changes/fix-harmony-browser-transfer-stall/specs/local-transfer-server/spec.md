## ADDED Requirements

### Requirement: Harmony transfer bridge SHALL use bounded binary payloads
在 HarmonyOS 上，本地传输服务在浏览器上传保存、共享文件下载、JS 与 Native 文件桥交互时，系统 MUST 以有界字节分块处理二进制数据。任何单次跨 Harmony/RNOH/Hermes 运行时边界的 `Uint8Array`、`ArrayBuffer` 或等价字节对象 MUST 小于实现定义的安全上限，并且 MUST NOT 使用 base64 字符串作为大文件二进制传递格式。

#### Scenario: Harmony browser uploads a large file
- **WHEN** 浏览器向鸿蒙设备上传大文件并触发 `/api/upload` 或分片上传接口
- **THEN** 本地传输服务 MUST 将请求体按安全字节上限拆分后写入 App 内部会话存储
- **AND** 系统 MUST NOT 因单个 `Uint8Array` 或请求体对象过大触发 `Property storage exceeds 196607 properties`
- **AND** 上传成功后文件 MUST 保持原始字节内容、文件名和相对路径信息

#### Scenario: Harmony browser uploads JSON content
- **WHEN** Android、桌面或移动浏览器向鸿蒙设备上传 `application/json` 文件
- **THEN** 本地传输服务 MUST 按字节文件处理该请求
- **AND** 系统 MUST NOT 因 JSON MIME 类型、文本解码路径或请求体桥接失败返回 500

#### Scenario: Browser downloads a large shared file from Harmony
- **WHEN** 浏览器请求下载鸿蒙 App 中用户显式加入共享列表的大文件
- **THEN** 本地传输服务 MUST 按 range、part 或等价分块方式读取并返回文件内容
- **AND** 每次传给 JS runtime 或从文件桥读取的二进制载荷 MUST 保持在安全上限内
- **AND** 系统 MUST NOT 为单次下载响应在 RN JS 内构造完整文件字节数组

#### Scenario: Harmony bridge fails during binary transfer
- **WHEN** 鸿蒙文件桥、静态服务或运行时边界在上传保存或共享下载过程中返回错误
- **THEN** 本地传输服务 MUST 返回结构化失败响应并中止当前文件任务
- **AND** 系统 MUST NOT 将半写入文件标记为可用、可下载或已成功接收
- **AND** 浏览器门户 MUST 能获取可理解的失败原因用于提示和重试

### Requirement: Transfer service SHALL avoid hanging browser requests after runtime failures
本地传输服务 MUST 捕获 Harmony/RNOH/Hermes 运行时边界抛出的二进制处理异常，并向浏览器返回明确的 HTTP 失败状态。系统 MUST NOT 让上传或下载请求在 App 侧异常后无限等待或停留在无进度状态。

#### Scenario: Hermes property storage limit would be exceeded
- **WHEN** 上传或下载处理检测到单次二进制载荷可能超过 Harmony/RNOH/Hermes 安全边界
- **THEN** 系统 MUST 拆分为更小的字节块继续处理，或返回可重试的失败响应
- **AND** App MUST NOT 因该文件任务崩溃或停止整个本地传输服务

#### Scenario: Service cannot continue a file transfer
- **WHEN** 存储空间不足、文件读取失败、用户撤销共享文件或服务停止导致当前传输无法继续
- **THEN** 系统 MUST 关闭该文件任务并向浏览器返回失败原因
- **AND** 后续新的上传、文本提交或其它共享文件下载请求 MUST NOT 被已失败任务永久阻塞

### Requirement: App workspace SHALL support batch selecting shared files for download
App 工作台的共享文件区 MUST 支持批量选择下载/保存。用户 MUST 能进入选择模式、选择多个当前共享文件、全选、清空选择，并对选中文件一次性发起显式下载/保存流程。批量操作 MUST 复用单文件导出/保存路径，不得绕过用户确认，也不得把文件自动写入系统公共目录。

#### Scenario: User selects multiple shared files in the app
- **WHEN** App 用户在共享文件区进入选择下载模式
- **THEN** 系统 MUST 展示每个共享文件的可选状态
- **AND** 用户 MUST 能选择或取消选择单个文件
- **AND** 系统 MUST 展示当前已选择文件数量

#### Scenario: User downloads selected files from the app
- **WHEN** App 用户选择多个共享文件并触发下载选中
- **THEN** 系统 MUST 对选中文件逐个或以受控并发发起现有显式导出/保存流程
- **AND** 系统 MUST 保持既有平台权限和保存交互，不得静默写入公共下载目录
- **AND** 成功或失败 MUST 以 App 内提示反馈给用户

#### Scenario: User triggers batch download without selection
- **WHEN** App 用户未选择任何共享文件即触发下载选中
- **THEN** 系统 MUST 阻止该操作并提示用户先选择要下载的文件
