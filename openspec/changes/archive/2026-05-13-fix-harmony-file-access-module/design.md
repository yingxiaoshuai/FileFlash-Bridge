## Context

当前鸿蒙端已经有 React Native 共享层、鸿蒙宿主工程和自定义 ArkTS 原生模块三段链路：JS 层通过文件适配器读写 App 沙盒文件，鸿蒙宿主负责注册 RNPackage，ArkTS `FPFileAccess` 负责实际文件读写、分块复制和系统保存。截图中的 toast 说明 JS 层仍然判断 `FPFileAccess` 不可用，实际风险可能来自模块未注册、注册名称不一致、debug 运行时加载旧 Metro bundle、HAP 未包含最新 ArkTS 代码，或 JS 在模块尚未就绪时缓存了空引用。

该修复跨越共享 TypeScript、鸿蒙 ArkTS 原生模块、HAP 打包加载和真机验证，属于平台专属实现；iOS 与 Android 继续使用既有 React Native 文件/系统保存路径，不引入新的权限语义。

## Goals / Non-Goals

**Goals:**

- 鸿蒙安装包启动后必须能稳定找到 `FPFileAccess`，不再误报缺少原生文件模块。
- 鸿蒙大文件上传保存、App 内导出到系统文件位置、从系统共享入口导入大文件都必须使用字节型数据或原生分块文件复制，不通过 base64 传递大文件二进制。
- 系统共享入口不得在 Ability 生命周期同步拷贝大文件，避免进入 App 后卡死。
- 文件操作失败时必须返回可区分原因：模块不可用、文件读写失败、空间不足、用户取消保存、源 URI 不可读等。
- 验证必须覆盖 JS 单测、TypeScript 检查、鸿蒙 bundle、HAP 构建安装和真机/模拟器大文件手工流程。

**Non-Goals:**

- 不改变浏览器门户的产品交互和局域网传输协议，除非现有实现仍通过 base64 传递上传或下载字节。
- 不把浏览器上传文件自动写入系统下载目录、相册或外部公开目录。
- 不新增 iOS 或 Android 原生模块；两端仅做回归验证，避免共享层修改造成行为退化。
- 不实现后台长期共享导入队列或多任务下载管理器。

## Decisions

### 1. 鸿蒙文件能力使用显式 `FPFileAccess` 原生桥

JS 层定义 `copyFile`、`readFile`、`readFileChunk`、`writeFile`、`appendFile`、`saveFileToDocuments` 六个能力，鸿蒙端由 ArkTS `FPFileAccessTurboModule` 实现。模块名称统一为 `FPFileAccess`，并在 `PackageProvider.ets` 注册。

选择原因：鸿蒙文件 URI、沙盒路径和系统保存器能力与 iOS/Android 差异明确，现有 RNFS/文档选择器路径对大文件和系统 URI 不够稳定。自定义桥接可以直接用 ArkTS 文件 API 分块复制，避免 JS 内存膨胀。

备选方案：继续使用 RNFS base64 或文档选择器缓存复制。该方案曾出现大文件卡死、内存占用高和模块误报，不能满足稳定性要求。

### 2. JS 层按需获取原生模块，不在启动时固化失败结果

`reactNativeAdapters.ts` 在每次鸿蒙文件操作前重新确认原生模块可用，并缓存成功结果；如果启动早期获取失败，不应让后续操作永久使用空引用。

选择原因：React Native Harmony 的 TurboModule/NativeModules 初始化时机可能晚于模块加载，按需获取能避免“启动时没拿到，后续永远报缺少模块”的假失败。

备选方案：App 启动时一次性强制探测。该方案诊断简单，但对初始化时序更脆弱。

### 3. 鸿蒙 debug/release 都优先使用 HAP 内置 bundle

鸿蒙入口应使用 `ResourceJSBundleProvider` 加载安装包内置 `bundle.harmony.js`。需要调试 Metro 时可以临时启用，但常规打包验证必须避免旧 Metro bundle 覆盖新 HAP。

选择原因：用户看到的 toast 很可能来自旧 JS bundle，即使 HAP 内已包含新 ArkTS 模块，旧 JS 仍可能走错误路径。内置 bundle 可保证“重新打包安装”与运行代码一致。

备选方案：继续 `AnyJSBundleProvider([Metro, Resource])`。该方案便于开发调试，但会让实际运行版本不可预测。

### 4. 大文件 I/O 走原生分块复制和 `Uint8Array`

鸿蒙上传保存和导出准备文件使用 JS `Uint8Array` 调用原生 `writeFile`/`appendFile`；已有沙盒文件导出到用户选择位置使用原生 `copyFileByChunks`。系统共享入口接收 URI 后异步分块复制到 App cache，并通过 manifest 通知 JS 消费。

选择原因：base64 会放大内存和 CPU 开销，对大文件非常不友好；同步复制会阻塞 Ability 生命周期，造成“点共享大文件 App 卡死”。

备选方案：分段 base64 写入。该方案比单次 base64 稳定，但仍违反字节型传输要求，并且占用额外编码成本。

### 5. 异常处理和用户提示分层

模块不可用时显示“安装包缺少原生模块，需要重新打包安装”；文件操作失败时显示实际文件错误；用户取消系统保存器时显示取消而不是错误；共享导入仍在拷贝时，JS 等待短时间轮询 manifest，超时后不阻塞 App 可用性。

选择原因：当前问题的 toast 太粗，无法区分构建问题、加载旧 bundle、文件权限或用户取消。分层提示能减少误判。

## Risks / Trade-offs

- [Risk] 鸿蒙 TurboModule 注册名称或 PackageProvider 未被入口使用 → 在 HAP 构建日志和运行时诊断中验证 `FPFileAccess` 包被编译、注册并可调用。
- [Risk] debug 模式无法连接 Metro 后开发体验下降 → 保留脚本或注释说明，需要调试 JS 时由开发者显式切换，但发布/验收路径固定使用内置 bundle。
- [Risk] 系统共享 URI 在部分来源 App 中不可直接通过路径读取 → 捕获并展示“源文件不可读/权限不足”，必要时后续补充基于系统 URI FD 的复制实现。
- [Risk] 大文件分块复制仍可能耗时较长 → 使用异步复制、进度前允许 App 启动，JS 轮询 manifest；后续可追加进度 UI。
- [Risk] 共享 TypeScript 修改影响 iOS/Android → 用现有单测、iOS/Android 文件导入导出冒烟和浏览器上传 JSON/大文件回归验证约束。

## Migration Plan

1. 在当前变更中修复鸿蒙原生模块注册、按需查找、内置 bundle 加载和大文件字节路径。
2. 重新执行 `npm run harmony:bundle`，再执行 debug HAP 或 release HAP 构建安装。
3. 在同一台鸿蒙设备/模拟器上卸载旧包或覆盖安装后验证，不依赖 Metro。
4. 若出现回归，回滚 JS 文件适配器和鸿蒙宿主改动，并恢复上一版 HAP；用户数据仍位于 App 沙盒，不需要数据迁移。

## Open Questions

- 是否需要为系统共享导入增加可见进度条，而不是只在后台等待 manifest。
- 是否需要在发布脚本中强制校验 bundle 内包含 `FPFileAccess` 调用和不存在旧的 base64 大文件写入路径。
