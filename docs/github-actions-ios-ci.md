# iOS GitHub Actions CI

这个仓库现在可以加一个用于 iOS 校验的 GitHub Actions 工作流：

- 触发条件：推送到 `main`
- 触发条件：针对 `main` 的 Pull Request
- 手动触发：`workflow_dispatch`
- 构建类型：`Debug` 模拟器构建
- 是否需要签名：不需要

对应工作流文件：

`/.github/workflows/ios-ci.yml`

## 工作流会做什么

工作流会依次执行：

1. `npm ci`
2. `npm run typecheck`
3. `npm test -- --runInBand`
4. `bundle exec pod install --project-directory=ios --deployment`
5. `xcodebuild` 模拟器构建

如果 iOS 构建失败，会自动上传 `xcodebuild.log` 作为 GitHub Actions artifact，便于排查。

## 你需要在 GitHub 上配置什么

这个 CI 方案是“无签名模拟器构建”，所以默认不需要下面这些内容：

- 不需要 Apple 证书
- 不需要 Provisioning Profile
- 不需要 App Store Connect API Key
- 不需要额外的 GitHub Secrets

你只需要确认下面几项：

- 仓库已开启 GitHub Actions
- 如果仓库是私有仓库，账号有可用的 macOS Actions 分钟数
- 如果你启用了分支保护，把这个工作流对应的检查项加到 required status checks

## 什么时候需要再补配置

如果你后面要把 CI 升级成下面这些场景，就需要再补签名和密钥配置：

- 导出 `.ipa`
- 上传 TestFlight
- 上传 App Store
- 在真机上自动化安装已签名包

这些能力不在当前这版 CI 范围内，当前版本只负责“代码校验 + iOS 可编译性校验”。

## 建议

先把这版 CI 跑通，再决定是否继续补：

- iOS release archive
- 自动签名
- TestFlight 发布
