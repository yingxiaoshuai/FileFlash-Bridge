## ADDED Requirements

### Requirement: App SHALL support Chinese and English for the mobile app shell
系统 MUST 为移动端 App 提供可切换的应用语言能力，首版支持 `zh-CN` 和 `en-US` 两种语言。首页 Tab、设置页、底部 Tab 标签以及本次变更新增或调整的公共界面文案 MUST 从统一语言资源中读取，而不是继续散落为页面内硬编码字符串。

#### Scenario: Render the mobile shell in Chinese
- **WHEN** 用户未设置语言偏好，或本地语言偏好为空 / 非法
- **THEN** 系统 MUST 回退到默认中文并以中文展示首页、设置页和底部 Tab 文案

#### Scenario: Render the mobile shell in English
- **WHEN** 用户当前语言偏好为 `en-US`
- **THEN** 系统 MUST 以英文展示首页、设置页和底部 Tab 文案

### Requirement: App SHALL allow language switching from Settings
系统 MUST 在设置页提供一个显式语言设置项。该设置项 MUST 使用语言图标作为视觉提示，并在用户点击该 item 或其附属按钮后展示可选语言菜单；当前菜单中 MUST 仅包含“中文”和“English”两个选项。

#### Scenario: Open the language menu from Settings
- **WHEN** 用户进入设置页并点击语言设置项
- **THEN** 系统 MUST 展示包含“中文”和“English”的下拉菜单或等价浮层

#### Scenario: Switch from Chinese to English
- **WHEN** 用户在语言菜单中选择 “English”
- **THEN** 系统 MUST 立即关闭菜单并将当前 App 文案切换为英文

#### Scenario: Switch from English to Chinese
- **WHEN** 用户在语言菜单中选择 “中文”
- **THEN** 系统 MUST 立即关闭菜单并将当前 App 文案切换为中文

### Requirement: App SHALL persist the selected language locally
系统 MUST 在本地持久化用户选择的语言偏好，并在 App 下次启动时继续使用该偏好。该持久化能力 MUST 仅影响 App 本地界面语言，不得改变局域网传输协议、服务端行为或新增网络权限需求。

#### Scenario: Restore the previously selected language on next launch
- **WHEN** 用户已选择语言并重新打开 App
- **THEN** 系统 MUST 在首次渲染移动端壳层时恢复上次选择的语言

#### Scenario: Fall back safely when the stored language is invalid
- **WHEN** 本地持久化的语言值缺失、损坏或不在支持列表中
- **THEN** 系统 MUST 回退到默认中文，并且不得因语言恢复失败阻断首页或设置页加载

### Requirement: Browser portal SHALL localize its UI based on the App language preference
系统 MUST 使浏览器端门户页面具备中文 / 英文两套文案资源，并在门户渲染时自动选择语言。门户语言 MUST 由 App 当前语言偏好决定：当 App 语言为 `zh-CN` 时门户展示中文；当 App 语言为 `en-US` 时门户展示英文。门户 MAY 通过服务端注入、配置参数或其它等价方式把语言选择传递给网页，但不得要求用户在网页端单独切换语言，也不得新增独立于 App 的网页端语言设置入口。

#### Scenario: Portal renders Chinese when app preference is zh-CN
- **GIVEN** App 当前语言偏好为 `zh-CN`（默认或用户选择）
- **WHEN** 其他设备通过 URL/二维码打开浏览器端门户
- **THEN** 门户 MUST 以中文展示其界面文案

#### Scenario: Portal renders English when app preference is en-US
- **GIVEN** App 当前语言偏好为 `en-US`
- **WHEN** 其他设备通过 URL/二维码打开浏览器端门户
- **THEN** 门户 MUST 以英文展示其界面文案

#### Scenario: Portal language switches after the user changes app language
- **GIVEN** 门户已被打开且 App 侧语言偏好发生切换
- **WHEN** 门户页面被重新加载、重新打开，或通过实现允许的方式重新获取门户配置
- **THEN** 门户 MUST 按新的 App 语言偏好展示文案
