## ADDED Requirements

### Requirement: App SHALL manage a reachable local transfer service
系统必须允许用户在 React Native App 内显式启动和停止本地传输服务，并在服务运行期间展示当前可访问地址、端口、网络模式和二维码。服务必须同时考虑公共 Wi-Fi 与手机热点两种接入模式，并在地址变化时刷新展示结果。

#### Scenario: Provide HTTP-only access URL and QR code
- **WHEN** 服务进入可用状态
- **THEN** 系统必须仅提供基于 **HTTP** 的访问 URL（不提供 HTTPS），并生成与该 URL 等价的二维码供其他设备扫码打开浏览器门户页

#### Scenario: Start service on a shared Wi-Fi network
- **WHEN** 用户已授予必要权限并在连接公共 Wi-Fi 时点击启动服务
- **THEN** 系统必须启动本地传输服务并展示可由同一局域网设备访问的 URL 与二维码

#### Scenario: Refresh address after network mode changes
- **WHEN** 用户从公共 Wi-Fi 切换到手机热点或网络接口发生变化
- **THEN** 系统必须更新对外访问地址并提示用户旧地址已失效

#### Scenario: Stop service manually
- **WHEN** 用户点击停止服务
- **THEN** 系统必须立即终止新的外部连接并在界面中标记服务为已停止

### Requirement: Service SHALL remain reachable when app is backgrounded / screen is off
系统必须提供后台保活能力，确保在 App 切到后台或设备息屏后，本地传输服务仍保持可访问，直到用户显式停止服务。

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
系统必须提供两种访问模式，且两种模式都基于 HTTP：
- **简单模式**：浏览器访问基础 URL 即可进入门户页。
- **安全模式**：浏览器访问 URL 必须携带 `key` 作为访问凭证；缺失或错误的 `key` 必须被视为未授权。

约束：
- `key` 必须由 App 生成并可一键刷新；刷新后旧 `key` 必须立即失效。
- 安全模式下，App 展示的“复制链接”和“二维码”必须包含 `key`。

#### Scenario: Access portal in simple mode
- **WHEN** 用户在 App 中选择“简单模式”并启动服务
- **THEN** 系统必须展示不包含 `key` 的 URL 与二维码，扫码或输入 URL 可直接打开门户页

#### Scenario: Access portal in secure mode
- **WHEN** 用户在 App 中选择“安全模式”并启动服务
- **THEN** 系统必须展示包含 `key` 的 URL 与二维码，且浏览器访问不带 `key` 的基础 URL 必须被拒绝或引导到未授权提示页

#### Scenario: Refresh key invalidates old URLs
- **WHEN** 用户在服务运行中点击“刷新 key”
- **THEN** 系统必须生成新的 `key` 并更新 URL/二维码；此前所有使用旧 `key` 的访问必须失效

### Requirement: Service SHALL accept browser-originated files and text payloads
系统必须提供面向浏览器的入站投递接口，允许其他设备向手机上传文件、上传文件夹内容并提交文本内容。文件上传成功后必须写入手机端配置的目标目录；文本提交成功后必须进入手机端文本接收区。V1.0 不要求服务向浏览器暴露手机文件下载能力。

#### Scenario: Upload one or more files to the mobile device
- **WHEN** 浏览器用户选择一个或多个文件并发起上传
- **THEN** 系统必须接收文件内容、将其写入目标目录，并返回每个文件的处理结果

#### Scenario: Preserve directory structure during folder upload
- **WHEN** 浏览器支持目录上传且用户提交一个文件夹
- **THEN** 系统必须按相对路径保留目录结构并将内容写入手机端目标目录

#### Scenario: Submit pasted text content to the mobile device
- **WHEN** 浏览器用户在门户页粘贴文本并提交
- **THEN** 系统必须接收该文本内容并把它写入手机端文本接收区

### Requirement: Service MUST surface availability limits and failure states
系统必须在服务不可用、端口绑定失败、权限缺失、目录未授权或网络不满足访问条件时向用户明确提示原因，并提供至少一种恢复路径，例如重试、重新授权、刷新地址或返回系统设置。

#### Scenario: Start fails because permissions are missing
- **WHEN** 用户在未完成文件访问或本地网络权限授权时启动服务
- **THEN** 系统必须阻止服务进入可用状态并引导用户完成缺失权限

#### Scenario: Network is not reachable by peers
- **WHEN** 系统检测到当前网络模式无法向其他设备提供局域网访问
- **THEN** 系统必须提示用户切换到可用 Wi-Fi 或热点模式并禁止展示误导性的可访问地址

#### Scenario: Target storage is not writable
- **WHEN** 浏览器发起上传但手机端目标目录不可写、空间不足或保存失败
- **THEN** 系统必须向浏览器端和手机端同时返回明确的失败原因，并提示用户重试或更换保存位置
