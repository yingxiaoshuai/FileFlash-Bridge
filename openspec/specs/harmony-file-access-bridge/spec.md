# harmony-file-access-bridge Specification

## Purpose
TBD - created by archiving change fix-harmony-file-access-module. Update Purpose after archive.
## Requirements
### Requirement: Harmony app SHALL expose the FPFileAccess native module
鸿蒙安装包 MUST 在 React Native Harmony 运行时注册并暴露名为 `FPFileAccess` 的原生文件访问模块。JS 层在执行鸿蒙文件读写、复制、导出或共享导入消费前，MUST 能通过 TurboModule 或 NativeModules 获取该模块；如果模块不可用，系统 MUST 给出明确的打包/安装修复提示，而不是继续执行会失败的大文件操作。

#### Scenario: FPFileAccess is available after HAP install
- **WHEN** 用户安装并启动鸿蒙 HAP 后执行文件保存、读取或导出操作
- **THEN** 系统 MUST 成功获取 `FPFileAccess` 原生模块并调用对应文件能力
- **AND** 不得显示“当前鸿蒙安装包缺少 FPFileAccess 原生文件模块”的错误提示

#### Scenario: Native module is genuinely missing
- **WHEN** 当前安装包未包含或未注册 `FPFileAccess`
- **THEN** 系统 MUST 阻止依赖该模块的大文件保存/导出操作
- **AND** 系统 MUST 提示用户重新打包安装包含原生模块的鸿蒙安装包

### Requirement: Harmony file bridge SHALL use byte-oriented binary transfer
鸿蒙端 JS 与原生文件桥之间传递文件内容时 MUST 使用 `Uint8Array`、`ArrayBuffer` 或等价字节结构。系统 MUST NOT 为鸿蒙大文件读写、追加、上传保存或导出准备路径使用 base64 字符串作为二进制传递格式。

#### Scenario: Browser upload writes bytes into app storage
- **WHEN** 浏览器向鸿蒙 App 上传 JSON、图片、压缩包或其它二进制文件
- **THEN** React Native 层 MUST 将请求体保留为字节数据
- **AND** 鸿蒙文件桥 MUST 以字节方式写入或追加到 App 沙盒存储

#### Scenario: Large stored file is read in chunks
- **WHEN** 浏览器下载鸿蒙 App 内已共享的大文件
- **THEN** 系统 MUST 通过字节分块读取文件内容
- **AND** 不得把整个大文件转换为 base64 后再返回给传输服务

### Requirement: Harmony file bridge SHALL copy large files in bounded chunks
鸿蒙端在 App 沙盒、系统选择位置和共享导入缓存之间复制文件时 MUST 使用有界大小的分块复制。复制过程 MUST 避免一次性加载完整大文件到 JS 内存或 ArkTS 内存。

#### Scenario: Export a large received file to user-selected location
- **WHEN** 用户在鸿蒙 App 内将一个大文件保存到系统文件选择器指定的位置
- **THEN** 系统 MUST 使用 `FPFileAccess` 将源文件分块复制到目标 URI
- **AND** 文件大小和内容 MUST 与源文件一致

#### Scenario: Copy failure preserves a clear error
- **WHEN** 源文件不可读、目标位置不可写或设备空间不足
- **THEN** 系统 MUST 停止当前复制并向 App 层返回明确失败原因
- **AND** 不得把该失败误报为 `FPFileAccess` 模块缺失

### Requirement: Harmony shared-file import SHALL not block app startup
鸿蒙端从系统共享入口接收文件时，MUST 避免在 Ability 启动或 `onNewWant` 路径中同步复制大文件。系统 MUST 允许 App 尽快进入可交互状态，并在后台完成共享文件缓存和 manifest 写入后再由 JS 层导入。

#### Scenario: Open app from a large shared file
- **WHEN** 用户从系统文件管理器或其它 App 共享一个大文件到文件闪传桥
- **THEN** 鸿蒙 Ability MUST 不因同步大文件复制而长时间卡死
- **AND** 文件复制完成后 App MUST 能将该文件加入当前分享列表或项目文件列表

#### Scenario: Shared-file copy is still in progress
- **WHEN** JS 层启动时共享文件仍在后台复制
- **THEN** 系统 MUST 等待或轮询共享导入 manifest 的完成状态
- **AND** 超过等待上限后 MUST 保持 App 可用并给出可恢复提示

### Requirement: Harmony build SHALL run the bundled JS that matches the installed HAP
用于验收和发布的鸿蒙安装包 MUST 运行 HAP 内置的 `bundle.harmony.js`，确保 JS 文件适配器与 ArkTS 原生模块来自同一次构建。调试 Metro 连接不得在验收路径中覆盖内置 bundle，从而导致旧 JS 错误提示重新出现。

#### Scenario: Rebuilt HAP contains the fixed file-access path
- **WHEN** 开发者执行鸿蒙 bundle 和 HAP 构建安装后启动 App
- **THEN** 运行时代码 MUST 来自该 HAP 内置 bundle
- **AND** 新的 `FPFileAccess` 按需查找、字节写入和共享导入逻辑 MUST 生效

