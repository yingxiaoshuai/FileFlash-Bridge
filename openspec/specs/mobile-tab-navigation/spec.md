# mobile-tab-navigation Specification

## Purpose
TBD - created by archiving change add-i18n-settings-tab. Update Purpose after archive.
## Requirements
### Requirement: App SHALL provide bottom tab navigation for Home and Settings
系统 MUST 在移动端提供底部 Tab 导航壳层，并包含两个一级入口：`首页` 和 `设置`。该导航壳层 MUST 在 iOS 与 Android 上共享一致的页面结构与状态切换语义。

#### Scenario: Show two primary tabs when the app is ready
- **WHEN** 用户进入已完成初始化的移动端 App
- **THEN** 系统 MUST 在底部展示“首页”和“设置”两个 Tab 入口

#### Scenario: Switch between Home and Settings tabs
- **WHEN** 用户点击底部 Tab 中的另一个入口
- **THEN** 系统 MUST 切换到对应页面，并更新当前激活 Tab 的选中状态

### Requirement: Home tab SHALL continue to host the current workspace flow
系统 MUST 将当前工作台放置在首页 Tab 下，并保持现有服务控制、共享文件查看、项目查看与相关操作语义不变。新增设置页后，首页 MUST 仍然是用户处理局域网投递与查看内容的主入口。

#### Scenario: Use the workspace from the Home tab
- **WHEN** 用户进入首页 Tab
- **THEN** 系统 MUST 展示当前工作台内容，并允许继续执行既有服务与项目相关操作

#### Scenario: Return to Home without losing current workspace context
- **WHEN** 用户从设置页切回首页 Tab
- **THEN** 系统 MUST 保留当前工作台上下文，而不是重置服务状态、共享列表或当前项目选择

### Requirement: Settings tab SHALL host app-level preferences instead of transfer operations
系统 MUST 将应用级偏好项放入设置页，并与首页中的传输工作区分离。设置页 MAY 承载后续更多应用偏好，但在本次变更中至少 MUST 包含语言设置项，并且不得复制首页中的主要传输操作入口。

#### Scenario: Open Settings and see app-level preferences
- **WHEN** 用户点击底部的设置 Tab
- **THEN** 系统 MUST 展示设置页及其偏好项列表，其中至少包含语言设置项

#### Scenario: Keep primary transfer operations out of Settings
- **WHEN** 用户停留在设置页
- **THEN** 系统 MUST 不在该页重复展示首页中的服务启动、共享文件导入或项目内容主操作区

