# FileFlash-Bridge Mobile / 文件闪传桥

English version: [README.en.md](./README.en.md)

[![Latest Release](https://img.shields.io/github/v/release/yingxiaoshuai/FileFlash-Bridge?display_name=tag&sort=semver)](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-0A84FF)](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases/latest)
[![Transfer](https://img.shields.io/badge/Transfer-LAN%20Direct-0A84FF)](https://github.com/yingxiaoshuai/FileFlash-Bridge)

把电脑浏览器里的文件、文本，直接送到手机里。

**文件闪传桥** 是一款面向 iPhone 和 Android 的局域网传输工具：同一 Wi-Fi 或热点下，打开 App、扫一下二维码，就能在浏览器里把文件传到手机，或者把手机共享的文件下载回电脑。

**不需要数据线，不需要登录账号，浏览器端也不用额外安装客户端。**

## 立即下载

- iOS：打开 App Store，搜索 **文件闪传桥**
- [下载最新版 Android APK](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases/latest/download/app-release.apk)
- [查看所有版本与更新记录](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases)
- [查看隐私政策](./docs/privacy-policy-zh.md)

> iOS 可通过 App Store 安装；Android 公开下载版本会在 GitHub Release 提供已签名 `APK`、`AAB` 与 `SHA256SUMS.txt`，方便安装与校验。
>
> Android 手机安装时，优先下载 `app-release.apk` 即可。

## 为什么值得下载

- **浏览器直连手机**：电脑端只要能打开浏览器，就能发送文本、上传文件，不用再装桌面客户端。
- **扫码就能开始**：App 会显示访问链接和二维码，连接路径足够直接。
- **大文件也能传**：上传和下载都支持分块处理，降低大文件失败率。
- **双向取回更方便**：手机里的会话文件可加入共享列表，浏览器直接下载取回。
- **适合多人协作分析**：把同一批文件共享出来后，团队成员可以分别下载、查看、分析，不用来回转发。
- **更适合局域网场景**：核心传输流程基于同一 Wi-Fi / 热点下的本地访问，适合办公室、实验室、现场演示等环境。
- **下载速度更痛快**：局域网直传少一层云端中转，拿文件通常更直接。
- **尽量不走公网流量**：同一局域网内传输时，不依赖外部网盘中转，更省公网流量成本。
- **离线也能继续用**：没有外网时，只要设备还在同一 Wi-Fi 或热点下，依然可以继续传。
- **安全模式可控**：开启后链接和二维码会携带访问 `key`，刷新地址后旧链接立即失效。

## 这些场景会很好用

- 把 `APK`、图片、PDF、压缩包、日志、测试包快速发到手机
- 在调试真机时，把文本片段、JSON、链接、配置内容直接投递到手机端
- 没带数据线、懒得登网盘、又不想折腾聊天工具时，临时传文件
- 把日志、样本、截图或资料共享给多位同事，让大家各自在电脑上下载分析
- 把手机端已经导入或生成的文件加入共享列表，再回到电脑浏览器下载

## 3 步开始使用

1. 在 iPhone 或 Android 手机上安装并打开 **文件闪传桥**。
2. 让手机和电脑处于同一 Wi-Fi 或热点，启动 App 内传输服务，复制链接或扫描二维码。
3. 在浏览器里上传文件、发送文本，或下载手机端已共享的文件。

浏览器端支持拖拽上传；在支持目录上传的环境下，也可以保留文件夹相对路径。

## 核心功能

| 功能 | 你能得到什么 |
|------|------|
| 浏览器传文本到手机 | 临时口令、代码片段、地址、说明文字都能快速送到手机 |
| 浏览器上传文件到手机 | 支持普通文件、小文件直传，以及大文件自动分块上传 |
| 手机共享文件给浏览器下载 | 手机端把文件加入共享列表，浏览器直接下载 |
| 导出与系统分享 | 收到的内容可以继续导出到系统目录或分享给其他 App |
| 安全模式 | 链接携带 `key`，更适合不希望被同网段其他人随手访问的场景 |

## 用户常关心的问题

### 传输的数据会经过云端吗？

核心传输流程依赖手机端启动的本地服务，主要面向同一 Wi-Fi / 热点下的浏览器直连访问。更完整说明请查看 [隐私政策](./docs/privacy-policy-zh.md)。

### 浏览器端需要安装客户端吗？

不需要。浏览器打开 App 提供的访问地址即可使用。

### 目前支持什么平台？

支持 **iOS** 和 **Android**。iOS 可在 App Store 搜索 **文件闪传桥**；Android 可从本仓库的 GitHub Release 下载 `APK` 安装。

### 离线状态也能用吗？

可以。只要设备仍在同一 Wi-Fi 或热点下，局域网传输就可以继续，不要求外网始终在线。

### 适合多人一起处理同一批文件吗？

适合。你可以把文件加入共享列表，让多位同事分别在各自浏览器里下载，用于查看、分析或留档。

### 如何确认安装包是否完整？

GitHub Release 会同时上传 `SHA256SUMS.txt`，可以配合下载产物进行校验。

## 开发与构建

<details>
<summary>展开开发者说明</summary>

### 环境要求

- **Node.js**：建议使用 **22.13.0**
- **Android**：JDK 17、Android SDK、Build Tools 36、NDK 27
- **iOS**：如需本地构建，需 Xcode、CocoaPods、Ruby Bundler
- **Windows**：已兼容 `gradlew.bat`，适合在 PowerShell 下直接调试和打包

### 本地调试

先安装依赖：

```bash
npm install
```

建议使用两个终端：

```bash
# 终端 1
npm run start
```

```bash
# 终端 2
npm run android
```

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run start` | 启动 Metro bundler |
| `npm run android` | 构建并安装 Android Debug 包 |
| `npm run ios` | 在 macOS + Xcode 环境下运行 iOS |
| `npm run test:unit` | 运行 Jest 单元测试 |
| `npm run typecheck` | 执行 `tsc --noEmit` |
| `npm run lint` | 执行 ESLint |
| `npm run android:apk` | 在 Windows 下构建 Android release APK |
| `npm run icons:generate` | 从根目录 `app.png` 重新生成 Android / iOS 图标资源 |

### 发布与补充文档

- [Android GitHub Release 自动发布](./docs/github-actions-android-release.md)
- [English Android release guide](./docs/github-actions-android-release.en.md)
- [Android 无线调试说明](./docs/android-wireless-debugging.md)
- OpenSpec 设计与约定：`openspec/changes/launch-fileflash-bridge-v1/`

</details>

如果这款工具正好解决了你的文件传输问题，欢迎下载试用，也欢迎通过 Issue 或 Star 告诉我它对你是否有帮助。

## License

See [LICENSE](./LICENSE).
