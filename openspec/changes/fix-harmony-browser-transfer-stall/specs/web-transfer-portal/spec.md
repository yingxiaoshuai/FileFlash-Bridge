## ADDED Requirements

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
