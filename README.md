# FileFlash-Bridge Mobile

基于 React Native + TypeScript 的 `FileFlash-Bridge` 移动端骨架，当前实现重点覆盖以下 OpenSpec 基线：

- `service`：统一的服务状态模型、网络模式解析、访问地址与本地 HTTP 控制器。
- `file-access`：会话内入站存储、文本项目持久化、共享列表与解压读出网关。
- `portal`：由 App 本地服务托管的响应式浏览器门户页面与同源交互脚本。
- `security`：简单模式 / 安全模式、`key` 校验、活跃连接上限与链接刷新逻辑。

## 目录

```text
mobile/
  App.tsx
  src/
    app/
    modules/
      service/
      file-access/
      portal/
      security/
    test-support/
```

## 开发命令

```bash
npm install
npm run start
npm run android
npm run ios
npm run test:unit
npm run typecheck
```

## 依赖说明

- `react-native-static-server`：本地 HTTP 服务承载门户页与同源 API。
- `@react-native-community/netinfo`：探测 Wi-Fi / 热点状态和地址变化。
- `react-native-fs`：会话内存储、共享文件读写与导出桥接。
- `react-native-qrcode-svg` + `react-native-svg`：生成二维码。
- `react-native-document-picker`：用户显式导出到外部位置。
- `react-native-share`：会话内显式分享 / 导出。

## iOS 构建要求

- 首次安装依赖后执行 `bundle install` 和 `bundle exec pod install`。
- 需要在 `Info.plist` 中配置本地网络权限文案，如 `NSLocalNetworkUsageDescription`。
- 如后续接入后台保活与 Bonjour 广播，需要补充相应后台模式与服务声明。

## Android 构建要求

- 使用 Android Studio Flamingo+ / Android SDK 35 以上环境。
- 调试设备需允许明文局域网访问，`AndroidManifest.xml` 已保留 `INTERNET` 入口，后续前台服务与网络状态权限可在同一文件继续扩展。
- 后续落地后台保活时，需要增加前台服务通知与 Android 13+ 通知权限处理。

## 当前状态

- 已初始化真实 React Native 工程。
- 已提供共享状态模型、会话内存储网关和浏览器门户模板。
- 原生网络服务、导出适配和真机验证任务仍需要在后续增量中继续补齐。
