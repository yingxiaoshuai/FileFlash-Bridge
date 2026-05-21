## ADDED Requirements

### Requirement: Service controls SHALL guide users through a stepwise sharing flow
系统 MUST 在 App 首页中将本地传输服务启动视为局域网共享流程的前置步骤。服务未运行时，用户 MUST 能通过首页中心主入口启动服务；服务运行前，系统 MUST 不展示会让用户误以为浏览器已可访问的地址、二维码或完整共享工作台。服务运行后，系统 MUST 展示当前可访问地址、二维码和后续共享操作入口。

#### Scenario: Start service from the primary step entry
- **WHEN** 用户在服务未运行时点击首页中心启动入口
- **THEN** 系统 MUST 执行与现有启动服务相同的权限检查、网络检查、安全模式配置和本地服务启动逻辑
- **AND** 成功后 MUST 生成当前访问 URL 与二维码

#### Scenario: Do not expose unavailable access affordances before startup
- **WHEN** 服务未启动、已停止或当前网络无法生成可达地址
- **THEN** 系统 MUST 不展示可复制的误导性访问地址或二维码
- **AND** 系统 MUST 以停止态、网络不可达或错误说明提示用户需要先完成启动条件

#### Scenario: Continue sharing after service becomes reachable
- **WHEN** 服务进入运行中且访问地址可达
- **THEN** 系统 MUST 允许用户继续执行添加共享文件、浏览共享列表、查看当前项目内容、复制访问链接、刷新地址和停止服务等既有操作
- **AND** 这些操作 MUST 复用现有服务控制、共享列表和项目数据语义

### Requirement: Stepwise service UI SHALL preserve transfer and permission behavior
步骤式服务 UI MUST 不改变浏览器文件上传、文件夹上传、文本提交、共享文件下载、App 内显式保存/导出、安全模式和后台保活的底层行为。iOS 与 Android 的权限申请、系统保存器、分享面板、前后台限制和错误提示 MUST 沿用现有平台能力；UI 改版不得绕过用户确认或扩大浏览器可访问文件范围。

#### Scenario: Browser uploads remain bound to the current session
- **WHEN** 服务运行后浏览器用户上传文件或文件夹
- **THEN** 系统 MUST 继续将内容写入当前会话绑定的 App 内部存储
- **AND** 不得因为首页步骤式 UI 改版自动写入系统公共下载目录、相册或其它外部位置

#### Scenario: Browser text submissions remain bound to the active project
- **WHEN** 服务运行后浏览器用户提交文本内容
- **THEN** 系统 MUST 继续把文本写入 App 端当前活跃项目的文本接收区
- **AND** 首页布局切换不得改变项目归属或覆盖既有消息

#### Scenario: Explicit file saving remains user-confirmed
- **WHEN** 用户在 App 内对已接收文件或共享文件执行保存、导出或下载选中
- **THEN** 系统 MUST 继续使用现有显式保存/导出流程
- **AND** 在 iOS 与 Android 上不得静默绕过系统权限、保存器或分享确认

#### Scenario: Service startup failures remain recoverable
- **WHEN** 启动服务因权限缺失、端口绑定失败、网络不可达或系统限制失败
- **THEN** 系统 MUST 在启动步骤中展示明确失败原因和可执行恢复动作
- **AND** 用户 MUST 能在问题修复后从同一主入口重新尝试启动
