## Why

鸿蒙安装包仍在运行时提示缺少 `FPFileAccess` 原生文件模块，导致大文件无法保存到本地，并且通过系统共享入口选择大文件时可能卡死或无法完成导入。这个问题直接阻断鸿蒙端的核心文件收发闭环，需要把原生模块注册、JS 调用、打包加载和大文件 I/O 路径作为一个整体修复。

## What Changes

- 修复鸿蒙 `FPFileAccess` 原生文件模块的注册、查找和打包加载链路，确保安装后的 App 能稳定调用文件读写、分块复制和系统文件保存能力。
- 将鸿蒙端文件读写、浏览器上传保存、App 内导出和系统共享导入统一为 `Uint8Array`/字节流路径，不再通过 base64 传递大文件二进制内容。
- 优化鸿蒙系统共享入口的大文件处理，避免在 Ability 启动或前台恢复路径中执行同步大文件拷贝。
- 增加运行时诊断和降级提示，区分“模块未注册/未打包”“模块可用但文件操作失败”“用户取消保存”等情况，避免长期误报缺少模块。
- 补齐测试与构建验证，覆盖 React Native 共享层、鸿蒙 ArkTS 原生模块、HAP 内置 bundle 和真机/模拟器大文件导入导出流程。

## Capabilities

### New Capabilities
- `harmony-file-access-bridge`: 定义鸿蒙端自定义原生文件访问桥接能力，包括模块可用性、字节型二进制传输、分块复制、系统保存和共享导入稳定性。

### Modified Capabilities
- `local-transfer-server`: 补充鸿蒙端浏览器上传、内部存储持久化、共享文件下载和显式导出必须依赖稳定字节型文件访问路径的要求。

## Impact

- 影响 React Native 文件适配层：`src/modules/file-access/reactNativeAdapters.ts`、`src/modules/file-access/inboundStorageGateway.ts` 及相关平台导出入口。
- 影响鸿蒙宿主工程：`harmony/entry/src/main/ets/PackageProvider.ets`、`harmony/entry/src/main/ets/pages/Index.ets`、`harmony/entry/src/main/ets/fpfileaccess/*`、`harmony/entry/src/main/ets/fpinboundsharing/*`。
- 影响鸿蒙打包流程：需要确认 `bundle.harmony.js` 使用安装包内置版本，并确保 release/debug HAP 均包含 `FPFileAccess`。
- 安全与隐私影响：文件仍只写入 App 沙盒或用户通过系统保存器显式选择的位置；共享导入仅处理系统传入 URI，不扩大目录访问范围。
- 平台范围：该修复主要针对 HarmonyOS；iOS 与 Android 共享代码不能回退到不稳定路径，现有上传、导出和权限语义必须保持不变。
