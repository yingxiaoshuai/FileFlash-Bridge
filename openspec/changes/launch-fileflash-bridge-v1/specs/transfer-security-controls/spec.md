## ADDED Requirements

### Requirement: Transfer service SHALL support password-protected access
系统必须允许用户为当前传输会话设置访问密码。未通过认证的浏览器请求不得浏览文件列表、下载文件或上传文件。密码校验失败时系统必须返回明确但不过度暴露内部信息的错误反馈。

#### Scenario: Access portal with correct password
- **WHEN** 浏览器用户输入正确的会话密码
- **THEN** 系统必须授予该会话访问传输页面和相关传输接口的权限

#### Scenario: Access portal with wrong password
- **WHEN** 浏览器用户输入错误密码或未提供密码访问受保护页面
- **THEN** 系统必须拒绝访问，并提示需要重新认证

### Requirement: Transfer service MUST limit exposure and active sessions
系统必须允许用户配置或使用默认的最大活动连接数，并在达到限制时拒绝新的连接请求。服务界面必须向用户展示当前活跃连接或会话数量，帮助用户识别是否存在超出预期的访问。

#### Scenario: New connection exceeds the active session limit
- **WHEN** 已有活动会话数量达到配置上限且新的浏览器尝试连接
- **THEN** 系统必须拒绝新连接并向请求方返回连接受限提示

#### Scenario: User reviews active sessions while service is running
- **WHEN** 用户打开服务状态区域
- **THEN** 系统必须显示当前活跃连接数量，并允许用户通过停止服务来立即终止访问

### Requirement: Transfer service SHALL offer transport security with explicit fallback
系统必须提供启用 HTTPS 的选项，并在本地证书生成与浏览器兼容性满足条件时通过 HTTPS 暴露传输门户。当 HTTPS 无法建立或不被当前环境接受时，系统必须明确告知用户已回落到 HTTP，并建议启用密码保护后再共享链接。

#### Scenario: HTTPS is available for the current environment
- **WHEN** 用户启用 HTTPS 且系统成功准备本地证书与安全监听端口
- **THEN** 系统必须展示 `https://` 访问地址并允许浏览器通过 HTTPS 建立连接

#### Scenario: HTTPS falls back to HTTP
- **WHEN** 用户启用 HTTPS 但当前环境无法建立受支持的本地安全连接
- **THEN** 系统必须提示 HTTPS 不可用、说明原因，并展示受密码保护的 HTTP 访问方案
