# FileFlash-Bridge Mobile

English version: [README.en.md](./README.en.md)

基于 **React Native 0.85** + **TypeScript** 的局域网「浏览器 ↔ 手机」文件与文本交换应用。

手机端启动本地 HTTP 服务后，同一 Wi-Fi 或热点下的设备可以直接在浏览器访问门户页，完成：

- 浏览器向手机发送文本
- 浏览器向手机上传文件
- 手机把会话文件加入共享列表，供浏览器下载取回

当前仓库已经包含 Android 本地调试、Android Release 自动发布，以及自维护的 React Native 本地 HTTP 桥接模块。

## 能力概览

| 能力 | 说明 |
|------|------|
| 本地传输服务 | 探测可用局域网地址，展示访问 URL 与二维码，支持简单 / 安全模式、访问 `key` 与连接数控制。 |
| 浏览器门户 | 内嵌响应式门户页，支持文本提交、小文件直传、大文件自动分块上传、共享文件列表与分块下载。 |
| 会话存储 | 入站内容写入 App 内会话目录，小型文本类内容可压缩，大文件和二进制文件保留原始字节。 |
| 导出与分享 | 手机端可将文件导出到系统文档目录，或通过系统分享流程发送给其他 App。 |
| 安全控制 | 安全模式下 URL 自动携带 `key`；点击“刷新地址”会同时刷新 IP / 链接与访问密钥。 |

## 文档索引

- 中文发布说明：[docs/github-actions-android-release.md](./docs/github-actions-android-release.md)
- English release guide: [docs/github-actions-android-release.en.md](./docs/github-actions-android-release.en.md)
- Android 无线调试说明：[docs/android-wireless-debugging.md](./docs/android-wireless-debugging.md)
- OpenSpec 设计与约定：`openspec/changes/launch-fileflash-bridge-v1/`

## 环境要求

- **Node.js**：建议使用 **22.13.0**，与当前 GitHub Actions 保持一致。
- **Android**：JDK 17、Android SDK、Build Tools 36、NDK 27，建议使用 Android Studio。
- **iOS**：如需本地构建，需 Xcode、CocoaPods、Ruby Bundler。
- **Windows**：仓库已兼容 `gradlew.bat`，适合在 PowerShell 下直接调试和打包。

## 快速开始

先安装依赖：

```bash
npm install
```

### 启动 Metro 与 Android Debug

建议使用两个终端：

```bash
# 终端 1
npm run start
```

```bash
# 终端 2
npm run android
```

更稳妥的调试方式是先手动启动模拟器或先连接真机，再执行 `npm run android`。

如果你在模拟器里运行服务，又想用电脑浏览器直接打开门户页，可参考：

- [docs/android-wireless-debugging.md](./docs/android-wireless-debugging.md)

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run start` | 启动 Metro bundler。 |
| `npm run android` | 构建并安装 Android Debug 包。 |
| `npm run ios` | 在 macOS + Xcode 环境下运行 iOS。 |
| `npm run test:unit` | 运行 Jest 单元测试。 |
| `npm run typecheck` | 执行 `tsc --noEmit`。 |
| `npm run lint` | 执行 ESLint。 |
| `npm run android:apk` | 在 Windows 下构建 Android release APK。 |
| `npm run icons:generate` | 从根目录 `app.png` 重新生成 Android / iOS 图标资源。 |

### Release 构建

如果你只是本地出包：

```powershell
npm run android:apk
```

如果你要生成上架用 `AAB`：

```powershell
cd android
.\gradlew.bat bundleRelease
```

如果你要走 GitHub 自动发版，请看：

- [docs/github-actions-android-release.md](./docs/github-actions-android-release.md)
- [docs/github-actions-android-release.en.md](./docs/github-actions-android-release.en.md)

## 仓库结构

```text
FileFlash-Bridge/
  App.tsx
  android/
  ios/
  docs/
  openspec/
  packages/
    fileflash-static-server/
  src/
    app/
    modules/
      file-access/
      portal/
      security/
      service/
    test-support/
```

主要目录说明：

- `App.tsx`：应用主界面与交互入口。
- `src/modules/service/`：局域网服务、HTTP 运行时、连接与安全控制。
- `src/modules/file-access/`：会话存储、压缩、导入导出、React Native 文件系统适配。
- `src/modules/portal/`：浏览器门户页 HTML / JS。
- `packages/fileflash-static-server/`：仓库内维护的 React Native 本地 HTTP 桥接模块。
- `docs/`：调试、发布等补充文档。

## 关键依赖

- `@fileflash/react-native-static-server`
  仓库内自维护的本地 HTTP 桥接模块，用来把浏览器请求桥接到 React Native JS 层。
- `@react-native-documents/picker`
  系统文件选择与导出保存。
- `react-native-share`
  系统分享导出能力。
- `react-native-fs`
  会话文件读写、分块上传落盘、导出复制。
- `@react-native-community/netinfo`
  获取 Wi-Fi / 热点与可用地址信息。
- `react-native-qrcode-svg` + `react-native-svg`
  展示访问链接二维码。
- `pako`
  移动端压缩 / 解压，和测试环境中的 `zlib` 对应。

## Android 说明

- 当前 Android 工程使用 **compileSdk 36**。
- 浏览器上传大文件时会自动走分块上传接口，避免单次请求体过大。
- App 内点击“刷新地址”时，会重新获取当前地址并轮换访问密钥。
- 如果你通过 AVD 调试，又想从主机浏览器访问服务，通常需要使用 `adb forward`。
- 图标源文件为根目录的 `app.png`，更新后执行 `npm run icons:generate`。

### 主机浏览器访问模拟器内服务

假设 App 内当前服务端口是 `8668`：

```bash
adb forward tcp:8668 tcp:8668
```

然后在电脑浏览器访问：

```text
http://127.0.0.1:8668
```

如果是安全模式，请从 App 内复制完整访问链接，再把主机改成 `127.0.0.1` 使用。

## iOS 说明

- 首次进入 iOS 开发环境建议执行：

```bash
bundle install
bundle exec pod install
```

- iOS 工程已保留本地网络相关方向的接入位，但实际发布流程目前以 Android 为主。
- 若后续接入完整 iOS 发布链路，建议补充独立的 iOS 发布文档。

## 测试与质量检查

建议在提交前至少执行：

```bash
npm run test:unit
npm run typecheck
```

必要时再执行：

```bash
npm run lint
```

## 常见问题

### 1. `npm install` 时出现 Node engine warning

React Native 0.85 对 Node 版本要求更严格，建议直接使用 **Node 22.13.0** 或更高兼容版本。

### 2. Android 安装失败或设备未识别

先执行 `adb devices`，确保目标设备状态为 `device`。

### 3. Metro 连不上手机

可确认设备与开发机网络连通，必要时使用：

```bash
adb reverse tcp:8081 tcp:8081
```

### 4. 浏览器访问不到门户页

确认：

- App 内服务已经启动
- 当前 IP / 端口与浏览器访问地址一致
- 若刚切换 Wi-Fi 或热点，已在 App 内点击过“刷新地址”

### 5. GitHub Release 没有自动触发

确认你推送的是形如 `v0.0.1` 的 tag，并且仓库 Secrets 已配置完整。

## License

See [LICENSE](./LICENSE).
