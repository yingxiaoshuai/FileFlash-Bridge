# Android GitHub Release 自动发布

English version: [github-actions-android-release.en.md](./github-actions-android-release.en.md)

这个仓库已经配置好了 Android 发布工作流：

- 工作流文件：[`/.github/workflows/android-release.yml`](../.github/workflows/android-release.yml)
- 触发方式：推送形如 `v0.0.1` 的 tag
- 发布产物：已签名 `APK`、`AAB`、`SHA256SUMS.txt`
- 发布位置：GitHub Release

## 发布流程

当你执行下面这类命令后：

```powershell
git tag v0.0.1
git push origin v0.0.1
```

GitHub Actions 会自动执行：

1. 检出代码。
2. 安装 Node.js、Java、Android SDK / Build Tools / NDK。
3. 执行 `npm ci`。
4. 从 tag 推导 Android 版本号。
5. 从 GitHub Secrets 动态重建签名 keystore。
6. 构建签名后的 `assembleRelease` 和 `bundleRelease`。
7. 生成 `SHA256SUMS.txt`。
8. 创建或更新对应的 GitHub Release，并上传产物。

## Tag 规则

工作流会匹配 `v*` 开头的 tag，但真正构建前还会继续校验版本格式。

当前要求 tag 必须是三段式数字版本：

- `v0.0.1`
- `v0.1.0`
- `v1.2.3`

不符合这个格式会直接失败。

## 版本号映射规则

工作流会从 tag 自动提取：

- `versionName = tag 去掉前缀 v`
- `versionCode = major * 1000000 + minor * 1000 + patch`

例如：

- `v0.0.1` -> `versionName = 0.0.1`，`versionCode = 1`
- `v1.2.3` -> `versionName = 1.2.3`，`versionCode = 1002003`

## 需要配置的 GitHub Secrets

进入仓库：

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

然后新增下面 4 个 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## 如何把 keystore 编码成 Base64

你的本地 keystore 路径是：

`E:\key\fileFlash.jks`

在 PowerShell 中执行：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('E:\key\fileFlash.jks')) | Set-Clipboard
```

执行后，剪贴板中的内容就是完整的 Base64 字符串，把它粘贴到 `ANDROID_KEYSTORE_BASE64` 即可。

如果你想先导出到文件再复制，也可以执行：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('E:\key\fileFlash.jks')) | Out-File -Encoding ascii .\fileFlash.jks.base64
```

## GitHub Actions 中如何重建 keystore

工作流会在 GitHub Runner 中执行下面这一步：

```bash
printf '%s' "${ANDROID_KEYSTORE_BASE64}" | base64 --decode > "${RUNNER_TEMP}/fileflash-release.jks"
```

这样做的好处是：

- `.jks` 文件不用提交到仓库
- keystore 只会在 CI 运行期间临时生成
- 构建完成后 Runner 会被回收

## 当前工作流里的关键构建环境

当前工作流使用的是：

- Node.js `22.13.0`
- Java `17`
- Android Platform `android-36`
- Build Tools `36.0.0`
- NDK `27.1.12297006`

## 发布后的产物

工作流会上传下面这些文件到 GitHub Release：

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/SHA256SUMS.txt`

## 常见失败点

### 1. Tag 格式不对

如果不是 `vX.Y.Z` 这种格式，工作流会在版本解析步骤失败。

### 2. Secret 没配全

如果缺少 keystore 或密码相关 Secret，签名构建会失败。

### 3. Base64 内容不完整

如果 `ANDROID_KEYSTORE_BASE64` 复制时被截断，CI 解码出的 keystore 会损坏，最终会在签名阶段报错。

## 建议的发布动作

每次发版前建议确认：

- `package.json` 中的版本语义和 tag 计划一致
- Android 构建本地至少能通过一次
- 4 个 GitHub Secrets 已经正确配置
- tag 使用正式版本号，例如 `v0.0.1`
