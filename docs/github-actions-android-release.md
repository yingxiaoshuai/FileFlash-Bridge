# Android GitHub Release 自动发布

这个仓库已经配置了一个 tag 触发的 GitHub Actions 工作流：

- 触发条件：推送形如 `v0.0.1` 的 tag
- 构建产物：签名后的 `APK`、`AAB`
- 发布位置：GitHub Release

## 需要配置的 GitHub Secrets

进入仓库：

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

新增下面 4 个 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## 本地把 keystore 编码成 Base64

你的证书文件路径是：

`E:\key\fileFlash.jks`

在 PowerShell 里执行：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('E:\key\fileFlash.jks')) | Set-Clipboard
```

执行后，剪贴板里就是完整的 Base64 内容，把它粘贴到 `ANDROID_KEYSTORE_BASE64` 即可。

如果你想先输出到文件再手动复制，也可以用：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('E:\key\fileFlash.jks')) | Out-File -Encoding ascii .\fileFlash.jks.base64
```

## 云端如何重建证书

工作流里会在 GitHub Runner 上执行下面这一步：

```bash
printf '%s' "${ANDROID_KEYSTORE_BASE64}" | base64 --decode > "${RUNNER_TEMP}/fileflash-release.jks"
```

这样证书只会在 GitHub Actions 运行期间临时生成，不需要把 `.jks` 文件提交到仓库里。

## 版本规则

工作流会从 tag 自动提取版本号：

- `v0.0.1` -> `versionName = 0.0.1`
- `v1.2.3` -> `versionCode = 1002003`

当前要求 tag 必须是三段式数字版本，例如：

- `v0.0.1`
- `v0.1.0`
- `v1.2.3`

## 发布方式

本地创建并推送 tag：

```powershell
git tag v0.0.1
git push origin v0.0.1
```

推送后，GitHub Actions 会自动：

1. 安装 Node / Java / Android SDK
2. 重建签名证书
3. 构建 release APK 和 AAB
4. 创建或更新对应的 GitHub Release
5. 上传构建产物和 `SHA256SUMS.txt`
