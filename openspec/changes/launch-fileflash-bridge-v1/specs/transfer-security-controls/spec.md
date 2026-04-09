## ADDED Requirements

### Requirement: Transfer service SHALL support simple mode and secure mode with URL key
系统必须支持两种访问模式：
- 简单模式：浏览器访问基础 URL 即可进入门户页。
- 安全模式：浏览器访问 URL 必须携带 `key` 作为访问凭证；缺失或错误的 `key` 不得访问门户、上传接口或文本提交接口。
系统必须允许用户刷新 `key`，刷新后旧 `key` 立即失效。

#### Scenario: Access portal in secure mode with a valid key
- **WHEN** 浏览器用户使用包含正确 `key` 的 URL 访问安全模式门户
- **THEN** 系统必须授予该会话访问传输页面和相关提交接口的权限

#### Scenario: Reject access with a missing or invalid key
- **WHEN** 浏览器用户缺少 `key` 或使用错误 `key` 访问安全模式门户
- **THEN** 系统必须拒绝访问，并提示需要重新获取正确链接或二维码

### Requirement: Transfer service MUST limit exposure and active sessions
系统必须允许用户配置或使用默认的最大活动连接数，并在达到限制时拒绝新的连接请求。服务界面必须向用户展示当前活跃连接或会话数量，帮助用户识别是否存在超出预期的访问。

#### Scenario: New connection exceeds the active session limit
- **WHEN** 已有活动会话数量达到配置上限且新的浏览器尝试连接
- **THEN** 系统必须拒绝新连接并向请求方返回连接受限提示

#### Scenario: User reviews active sessions while service is running
- **WHEN** 用户打开服务状态区域
- **THEN** 系统必须显示当前活跃连接数量，并允许用户通过停止服务来立即终止访问

### Requirement: Transfer service SHALL communicate HTTP-only security posture clearly
系统在 V1.0 中必须仅通过 HTTP 对外提供访问，不提供 HTTPS 选项。App 必须明确告知用户当前为 HTTP 访问，并提示仅在可信 Wi-Fi 或手机热点中使用；当用户选择简单模式时，还必须提醒该模式更适合低风险场景。

#### Scenario: Display HTTP access information
- **WHEN** 服务启动成功并展示对外访问地址
- **THEN** App 必须展示 `http://` 地址，并提示当前仅适用于可信局域网环境

#### Scenario: Warn when using simple mode
- **WHEN** 用户切换到简单模式或复制简单模式链接
- **THEN** App 必须提醒该模式不包含 `key` 防护，建议仅在低风险网络环境中使用
