# FileFlash-Bridge Mobile

基于 **React Native 0.85** + **TypeScript** 的局域网「浏览器 ↔ 手机」文件与文本交换应用：手机端启动本地 HTTP 服务，同一 Wi-Fi 或热点下的设备通过浏览器访问门户页即可上传文件、提交文本；用户可在 App 内将会话文件加入共享列表，供浏览器分块下载取回。

## 能力概览

| 能力 | 说明 |
|------|------|
| 本地传输服务 | 探测可用局域网地址，展示访问 URL 与二维码；简单 / 安全模式、`key` 与连接数控制。 |
| 浏览器门户 | 内嵌响应式页面：上传（小文件整包、大文件自动分块）、文本提交、共享文件列表与分块下载。 |
| 会话存储 | 入站内容写入 App 内会话目录；小文件可压缩封装，大文件跳过压缩；导出走系统文档选择器 / 分享。 |
| 安全控制 | 安全模式下 URL 携带 `key`；点击「刷新地址」时会同时轮换 `key`，旧链接与旧二维码失效。 |

更细的产品与接口约定见仓库内 **OpenSpec**：`openspec/changes/launch-fileflash-bridge-v1/`（`proposal.md`、`design.md`、各 `specs/`）。

## 环境要求

- **Node.js**：`>= 22.11.0`（见 `package.json` 的 `engines`）。
- **Android**：JDK 17、Android SDK（建议 **compileSdk 36**）、Android Studio 或已配置命令行工具；真机或 AVD 用于调试。
- **iOS**（可选）：Xcode、CocoaPods；首次需 `bundle install` 与 `bundle exec pod install`。
- **Windows**：Android 打包脚本使用 `gradlew.bat`；PowerShell 下 `npm run android:apk` 已在脚本中进入 `android` 目录调用 Gradle。

## 快速开始

```bash
npm install
```

### 启动 Metro 与 Android

建议使用**两个终端**：

```bash
# 终端 1：JS 打包器
npm run start
```

```bash
# 终端 2：编译并安装 Debug 到设备
npm run android
```

**关于模拟器**：`react-native run-android` 仅在 `adb devices` 无可用目标时尝试拉起 AVD，且需正确配置 **`ANDROID_HOME` / `ANDROID_SDK_ROOT`**，并将 **`$ANDROID_HOME/emulator`** 加入 `PATH`，否则可能无法自动启动。更稳妥的做法是先手动启动模拟器或连接真机，再执行 `npm run android`。

### 其他脚本

| 命令 | 说明 |
|------|------|
| `npm run ios` | 在已配置好的 macOS + Xcode 环境下构建并运行 iOS。 |
| `npm run test:unit` | Jest 单元测试（`--runInBand`）。 |
| `npm run typecheck` | `tsc --noEmit`。 |
| `npm run lint` | ESLint。 |
| `npm run android:apk` | 在项目根目录执行 Windows 下的 `android\gradlew.bat assembleRelease`，产出 `android/app/build/outputs/apk/release/app-release.apk`。 |

**Release AAB（上架用）** 可在 `android` 目录执行：

```bash
cd android
.\gradlew.bat bundleRelease
```

产物位于 `android/app/build/outputs/bundle/release/`。正式上架前请在 `android/app/build.gradle` 中配置**正式签名**，勿长期使用 debug 签名打 Release。

## 仓库结构

```text
FileFlash-Bridge/
  App.tsx                 # 应用根 UI
  android/                # Android 工程
  ios/                    # iOS 工程
  openspec/               # OpenSpec 变更与规格
  packages/
    fileflash-static-server/  # 仓库自带 RN 本地 HTTP 桥接模块
  src/
    app/                  # 主题、useAppModel 等
    modules/
      service/            # 传输服务、HTTP 运行时、网络解析
      file-access/        # 入站存储网关、RN 文件适配
      portal/             # 浏览器门户 HTML 文档
      security/           # 访问控制、key、连接注册
    test-support/         # Node 侧测试用 FileSystem / HTTP 运行时
```

## 依赖说明（主要）

- **@fileflash/react-native-static-server**：仓库内自维护的 RN 本地 HTTP 桥接模块，承载门户与同源 API；与 `reactNativeHttpRuntime` 配合将请求桥接到 JS 层。
- **@react-native-community/netinfo**：Wi-Fi / 热点与地址相关状态。
- **react-native-fs**：会话目录、分块上传落盘、导出与复制。
- **react-native-qrcode-svg** + **react-native-svg**：展示访问链接二维码。
- **@react-native-documents/picker** / **react-native-share**：系统文件选择、另存为与分享导出。
- **pako**：与存储网关配合的压缩/解压（与 Node 测试侧 `zlib` 对应）。

## Android 说明

- 推荐使用 **Android Studio** 与 **SDK 35** 对齐工程配置。
- **`AndroidManifest.xml`** 已包含网络相关基础权限；本地静态服务模块内已包含前台服务与数据同步前台服务类型声明。
- **应用图标**：源图为仓库根目录 **`app.png`**。更新该图后执行 **`npm run icons:generate`**，会重写 Android 各 `mipmap-*` 的 `ic_launcher` / `ic_launcher_round` 与 iOS `AppIcon.appiconset` 资源，再将变更一并提交。
- **大文件浏览器上传**：超过门户配置的 `chunkSize`（默认 1MB）时，门户会走 `begin → part → finish` 分块接口，避免单次请求体过大导致原生 OOM；小文件仍为单次 `POST /api/upload`。
- **调试**：若 Metro 与设备不在同一网段策略下，可使用 `adb reverse tcp:8081 tcp:8081`（USB 连接时）以便加载 JS。

### 主机浏览器访问 AVD 内的本地服务

本 App 的传输服务跑在 **模拟器内部** 的端口上（默认 **8668**，以 App 内展示的端口为准）。模拟器使用独立虚拟网段，**你电脑上的浏览器不能**像访问真机热点那样直接扫模拟器内网 IP。

在 **真实主机** 的 PowerShell 或 CMD 中执行（将 `8668` 换成你当前服务端口）：

```bash
adb forward tcp:8668 tcp:8668
```

然后在 **主机浏览器** 访问：

```text
http://127.0.0.1:8668
```

含义：**本机 `127.0.0.1:8668`** 经 ADB **转发到当前 adb 目标（模拟器）上的 `8668`**，从而打开模拟器里同一端口上的门户页或服务。

- **多台设备**：先执行 `adb devices` 查看序列号，再指定设备，例如：  
  `adb -s emulator-5554 forward tcp:8668 tcp:8668`
- **关闭该转发**：`adb forward --remove tcp:8668`

安全模式下 URL 需带 `key` 等查询参数时，请从 App 内复制完整访问链接（或二维码解析结果）再访问，仅换主机与端口即可。

**若浏览器提示 `ERR_EMPTY_RESPONSE`（127.0.0.1 未发送任何数据）**：`adb forward` 会把连接转到模拟器上的 **`127.0.0.1:端口`**。本仓库的本地 HTTP 模块在非 localhost 模式下会绑定 **全部网卡**，同时仍用探测到的 IP 拼展示用 URL；请 **重新编译并安装** Debug 包（例如 `npm run android`）后再执行 `adb forward`。仍异常时请确认：App 内传输服务已启动、转发端口与 App 内端口一致、以及 `adb devices` 指向当前模拟器。

## iOS 说明

- 首次安装依赖后：`bundle install`、`bundle exec pod install`。
- 在 **`Info.plist`** 中配置本地网络用途说明（如 `NSLocalNetworkUsageDescription`），否则局域网发现与访问可能受限。
- 若需后台长时间保活或 Bonjour，需在后续迭代中补充后台模式与权限文案。

## 测试与质量

```bash
npm run test:unit
npm run typecheck
```

CI 或提交前建议至少跑通单元测试与类型检查。

## 常见问题（简要）

1. **`adb` 无设备 / `installDebug` 失败**  
   确认已连接真机（USB 调试或无线调试）或已启动 AVD，且 `adb devices` 为 `device` 状态。

2. **Metro 连不上手机**  
   同网段访问开发机 IP:8081，或使用 `adb reverse`；防火墙需放行 8081。

3. **Gradle / 缓存类构建错误**  
   可尝试 `cd android && .\gradlew.bat clean` 后重编；若依赖 AAR 损坏可清理用户目录下 `.gradle/caches` 中对应条目后重试。

4. **iOS Pods 未同步**  
   依赖变更后请在 macOS 上执行 `bundle exec pod install`，确保 `@react-native-documents/picker` 与仓库内静态服务模块都被 CocoaPods 重新集成。

## 许可证

见仓库根目录 `LICENSE`。
