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

### Requirement: Service SHALL expose mobile files for browser download
系统必须对已授权目录中的文件和文件夹提供可浏览的下载入口，支持单文件直接下载，并支持将文件夹打包后提供下载链接。下载接口必须支持大文件稳定传输，并在浏览器重复请求同一文件片段时支持断点续传所需的 Range 行为。

#### Scenario: Download a single file from browser
- **WHEN** 浏览器访问传输页并选择一个文件进行下载
- **THEN** 系统必须返回该文件内容并触发浏览器下载

#### Scenario: Download a folder as an archive
- **WHEN** 浏览器选择一个文件夹进行下载
- **THEN** 系统必须生成可下载的归档文件并在下载完成后清理临时产物

#### Scenario: Resume a large file download
- **WHEN** 浏览器对同一文件发起带有有效 Range 头的续传请求
- **THEN** 系统必须返回对应字节区间而不是重新发送整个文件

### Requirement: Service MUST surface availability limits and failure states
系统必须在服务不可用、端口绑定失败、权限缺失、目录未授权或网络不满足访问条件时向用户明确提示原因，并提供至少一种恢复路径，例如重试、重新授权、刷新地址或返回系统设置。

#### Scenario: Start fails because permissions are missing
- **WHEN** 用户在未完成文件访问或本地网络权限授权时启动服务
- **THEN** 系统必须阻止服务进入可用状态并引导用户完成缺失权限

#### Scenario: Network is not reachable by peers
- **WHEN** 系统检测到当前网络模式无法向其他设备提供局域网访问
- **THEN** 系统必须提示用户切换到可用 Wi-Fi 或热点模式并禁止展示误导性的可访问地址
