## ADDED Requirements

### Requirement: Harmony local transfer SHALL persist uploaded files through a byte-safe storage path
在 HarmonyOS 上，局域网传输服务接收浏览器上传文件时，系统 MUST 将请求体作为字节数据处理，并通过稳定的 App 内部存储路径持久化。该路径 MUST 支持 JSON、文本、图片、压缩包和大文件，不得因为 MIME 类型为 `application/json` 或文件较大而返回 500。

#### Scenario: Android browser uploads JSON to Harmony device
- **WHEN** Android 浏览器向鸿蒙设备上的 `/api/upload` 上传 `application/json` 文件
- **THEN** 鸿蒙 App MUST 将文件内容作为 `Uint8Array` 或等价字节体保存到当前会话存储
- **AND** 服务 MUST 返回成功响应，不得因为 JSON 内容按文本解析或二进制转换失败而返回 500

#### Scenario: Browser uploads a large binary file to Harmony device
- **WHEN** 浏览器向鸿蒙设备上传超过压缩跳过阈值的大文件
- **THEN** 系统 MUST 跳过高风险压缩或全量内存转换
- **AND** 文件 MUST 以完整字节内容保存到 App 沙盒内的当前会话目录

### Requirement: Harmony explicit export SHALL save stored files through the platform file bridge
在 HarmonyOS 上，用户从 App 内显式保存或导出已接收文件时，系统 MUST 使用鸿蒙平台文件桥调用系统保存器或平台等价能力，并把 App 沙盒中的源文件分块复制到用户选择的位置。浏览器上传成功不得自动写入外部目录；只有用户在 App 内执行保存/导出后，文件才可离开 App 沙盒。

#### Scenario: User exports a large received file on Harmony
- **WHEN** 用户在鸿蒙 App 内对一个已接收的大文件执行保存到本地操作
- **THEN** 系统 MUST 打开系统保存位置选择能力或平台等价保存能力
- **AND** 用户确认目标位置后，系统 MUST 使用分块复制写入完整文件

#### Scenario: User cancels Harmony export
- **WHEN** 用户在鸿蒙系统保存器中取消操作
- **THEN** 系统 MUST 保留 App 内原始文件
- **AND** 系统 MUST 显示取消或无操作结果，不得显示模块缺失或文件损坏错误

### Requirement: Harmony runtime failures SHALL be reported without corrupting transfer state
在 HarmonyOS 上，文件桥、存储或系统 URI 访问失败时，系统 MUST 保持当前会话索引和既有文件数据一致，不得把半写入文件标记为可下载或已导出。失败信息 MUST 能让用户或开发者区分模块加载问题、文件访问问题、网络上传问题和用户取消操作。

#### Scenario: File bridge fails during upload persistence
- **WHEN** 鸿蒙文件桥在浏览器上传保存过程中返回写入失败
- **THEN** 传输服务 MUST 向浏览器返回失败响应
- **AND** App 端 MUST 不得把未完整写入的文件加入项目文件列表或共享文件列表

#### Scenario: File bridge fails during shared download read
- **WHEN** 浏览器请求下载共享文件分块但鸿蒙文件桥读取失败
- **THEN** 服务 MUST 返回明确的失败响应
- **AND** 浏览器门户 MUST 按既有分块重试策略处理，重试耗尽后提示传输失败
