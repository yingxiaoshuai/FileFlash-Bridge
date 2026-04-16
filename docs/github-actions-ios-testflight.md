# iOS TestFlight GitHub Actions

这个仓库现在可以额外配置一条 iOS 发布工作流，把 `Release` 包上传到 TestFlight。

对应工作流文件：

`/.github/workflows/ios-testflight.yml`

## 触发方式

- 手动触发：`workflow_dispatch`
- 推送 tag：`ios-v1.0.1`

如果你手动触发时填写了 `marketing_version`，工作流会用这个值覆盖工程里的 `MARKETING_VERSION`。

如果你推送的是 `ios-v1.0.1` 这类 tag，工作流会自动把 `1.0.1` 作为上传版本号。

`CURRENT_PROJECT_VERSION` 会自动使用 GitHub Actions 的 `run number`，避免重复上传相同 build number。

## 工作流会做什么

工作流会依次执行：

1. `npm ci`
2. `npm run typecheck`
3. `npm test -- --runInBand`
4. `bundle exec pod install --project-directory=ios --deployment`
5. 读取 Xcode `Release` 配置里的实际 `Bundle ID`、`Team ID`、`MARKETING_VERSION`
6. 使用 App Store Connect API key 自动签名并执行 `archive`
7. 导出并上传到 App Store Connect / TestFlight

失败时会自动上传构建日志 artifact，便于排查。

## 需要配置的 GitHub Secrets

进入仓库：

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

新增下面 3 个 secrets：

- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`

`APP_STORE_CONNECT_PRIVATE_KEY` 的值就是 `.p8` 文件全文内容。

## 还需要满足的 Apple 侧条件

这条工作流不需要你把证书私钥或 provisioning profile 提交到仓库，但 Apple 侧仍然必须满足下面条件：

- App Store Connect 里已经创建了对应 App 记录
- App 记录的 Bundle ID 必须和 Xcode `Release` 配置实际解析出的 Bundle ID 一致
- Xcode 工程使用自动签名
- 你的开发者账号已经接受最新协议
- App Store Connect API key 拥有足够权限

工作流执行时会把实际读取到的 `Bundle ID` 和 `Team ID` 打到运行摘要里，方便你核对。

## 注意

如果 App Store Connect 里创建的是 `com.fileflashbridge`，但 Xcode `Release` 配置实际构建出来的是别的 Bundle ID，上传一定会失败。

先以工作流摘要里打印出来的 `Bundle ID` 为准，不要只看 `Info.plist`。
