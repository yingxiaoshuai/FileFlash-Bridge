# Harmony 本地打包

鸿蒙正式包现在只走本地打包，不再依赖 GitHub Actions 自动发布。

## 1. 准备本地私有配置

复制示例文件：

```powershell
Copy-Item .\config\harmony-release.local.example.json .\config\harmony-release.local.json
```

然后编辑 `config/harmony-release.local.json`，推荐直接使用本地明文配置和签名文件路径：

```json
{
  "releaseConfig": {
    "bundleName": "FileFlash.bridge.huawei",
    "storePassword": "你的 p12 密码",
    "keyAlias": "你的别名",
    "keyPassword": "你的 key 密码",
    "vendor": "fileflash",
    "signingName": "default",
    "signAlg": "SHA256withECDSA"
  },
  "signing": {
    "directory": "D:\\sign",
    "certPath": "D:\\sign\\distribution.cer",
    "storeFilePath": "D:\\sign\\distribution.p12"
  }
}
```

如果你把 `.cer`、`.p12`、`.p7b` 都放在同一个目录，推荐直接填 `signing.directory`。
脚本会自动在这个目录里查找：

- `*.cer`
- `*.p12`
- `*.p7b`

其中 `.p7b` 是鸿蒙正式签名必需文件，不能省略。

这个文件已经被 `.gitignore` 忽略，不会上传。

## 2. 直接本地打包

```powershell
npm run harmony:release-hap
```

这个命令会自动：

1. 读取本地私有配置
2. 使用你本地的签名文件
3. 生成 Harmony JS bundle
4. 写入本地 `harmony/build-profile.json5`
5. 构建签名后的 `.hap`

产物位置通常在：

`harmony/entry/build/default/outputs/default/`

## 3. 兼容旧的 Base64 配置

如果你还是想沿用旧格式，也仍然支持：

```json
{
  "HARMONY_RELEASE_CONFIG_JSON_BASE64": "你的 Base64 JSON",
  "HARMONY_SIGNING_ARCHIVE_BASE64": "你的 Base64 ZIP"
}
```

### 生成 `HARMONY_RELEASE_CONFIG_JSON_BASE64`

先准备一个本地 JSON，例如 `harmony-release.json`：

```json
{
  "bundleName": "FileFlash.bridge.huawei",
  "storePassword": "你的 p12 密码",
  "keyAlias": "你的别名",
  "keyPassword": "你的 key 密码",
  "vendor": "fileflash"
}
```

再执行：

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .\harmony-release.json -Raw)))
```

把输出粘贴到 `config/harmony-release.local.json` 的 `HARMONY_RELEASE_CONFIG_JSON_BASE64`。

### 生成 `HARMONY_SIGNING_ARCHIVE_BASE64`

准备这 3 个签名文件，并且最终压缩包里必须使用下面这 3 个名字：

- `distribution.cer`
- `distribution.p7b`
- `distribution.p12`

示例：

```powershell
$tempDir = Join-Path $pwd 'harmony-signing'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Copy-Item 'C:\sign\release.cer' (Join-Path $tempDir 'distribution.cer') -Force
Copy-Item 'C:\sign\release.p7b' (Join-Path $tempDir 'distribution.p7b') -Force
Copy-Item 'C:\sign\release.p12' (Join-Path $tempDir 'distribution.p12') -Force
Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath .\harmony-signing.zip -Force
[Convert]::ToBase64String([IO.File]::ReadAllBytes('.\harmony-signing.zip'))
```

把输出粘贴到 `config/harmony-release.local.json` 的 `HARMONY_SIGNING_ARCHIVE_BASE64`。

## 4. 可选覆盖项

如果你想临时覆盖默认配置，可以先设置环境变量再执行：

```powershell
$env:HARMONY_LOCAL_RELEASE_CONFIG_PATH='D:\secret\harmony-release.local.json'
$env:HARMONY_APP_VERSION_NAME='1.0.0'
$env:HARMONY_APP_VERSION_CODE='1000000'
npm run harmony:release-hap
```
