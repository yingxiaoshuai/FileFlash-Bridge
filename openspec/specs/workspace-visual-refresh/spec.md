# workspace-visual-refresh Specification

## Purpose
TBD - created by archiving change refresh-paper-ui-apple-style. Update Purpose after archive.
## Requirements
### Requirement: App SHALL use React Native Paper as the primary workspace component system
系统 MUST 在 React Native App 主工作台中使用 React Native Paper 作为主要组件体系，统一承载按钮、图标按钮、菜单、列表项、表面容器、提示反馈和输入相关界面。若存在项目语义包装组件，这些包装组件也必须建立在 React Native Paper 组件和同一套主题 token 之上，而不得继续扩散彼此独立的自定义基础控件实现。

#### Scenario: Render workspace actions with the Paper component system
- **WHEN** 用户查看主工作台中的服务控制、项目历史、共享列表、消息列表或文件列表
- **THEN** 系统必须以 React Native Paper 组件或基于其主题能力的共享包装组件呈现这些操作与内容

#### Scenario: Keep interaction semantics stable while replacing components
- **WHEN** 工作台界面从旧的自定义基础控件迁移到 Paper 组件体系
- **THEN** 系统必须保持现有项目切换、服务启停、文件导入导出、共享切换、删除确认和文本复制等交互语义不变

### Requirement: Workspace SHALL provide an Apple-inspired neutral visual language
系统 MUST 为 App 主工作台和浏览器门户页提供统一的视觉主题，其整体风格应接近 Apple 风格的克制、轻盈和层次清晰的质感。该主题必须使用中性冷白、微灰或轻蓝灰作为背景与表面基底，不得继续以淡黄色作为主背景或大面积表面颜色；同时必须统一圆角、阴影、边框、文本层级和强调色规则。

#### Scenario: Remove pale yellow surfaces from the workspace
- **WHEN** 用户打开主工作台首页、项目历史侧边栏、消息列表、文件列表或浏览器门户页
- **THEN** 系统不得再以淡黄色作为主背景或主要表面色

#### Scenario: Preserve a clear visual hierarchy with restrained accents
- **WHEN** 用户在 App 或浏览器门户页中查看主要操作、次要操作、危险操作、空态和提示信息
- **THEN** 系统必须通过统一的表面层级、文本对比、圆角、阴影和有限的强调色建立清晰层次，而不得依赖杂乱的颜色堆叠

### Requirement: Browser portal SHALL align with the refreshed visual system
系统 MUST 让浏览器门户页与 App 主工作台在视觉语言上保持一致，包括背景基调、卡片层次、按钮状态、横幅反馈、列表项和空态说明。门户页无需直接使用 React Native Paper，但其 HTML/CSS 输出必须遵循同一套设计方向，不得保留旧的浅黄色纸面风格。

#### Scenario: Open the portal with the refreshed visual style
- **WHEN** 用户从浏览器访问手机端展示的传输地址
- **THEN** 系统必须返回符合新视觉系统的门户页，并在 hero、上传区、文本区和共享下载区中保持统一风格

#### Scenario: Keep portal feedback consistent with the app
- **WHEN** 门户页处于待上传、上传中、提交成功、下载中、失败或服务离线状态
- **THEN** 系统必须用与 App 一致的状态语义和高可读反馈样式展示这些状态

### Requirement: Workspace SHALL provide consistent feedback for operational states
系统 MUST 在工作台中以统一的视觉语言展示加载中、空态、成功、警告、错误和危险确认等操作状态，确保文件上传后的项目内容变化、文本提交后的消息列表变化、文件导出保存入口、共享切换结果和失败原因都能被明确感知。

#### Scenario: Show consistent feedback for empty, loading, and failure states
- **WHEN** 服务未启动、项目为空、共享列表为空、导出失败或网络不可达
- **THEN** 系统必须使用统一的反馈样式向用户说明当前状态和可执行的恢复动作

#### Scenario: Keep destructive actions clearly distinguishable
- **WHEN** 用户执行删除项目、删除消息、删除文件或移出共享等危险操作
- **THEN** 系统必须继续以明显区别于普通操作的视觉样式和确认流程展示这些动作

### Requirement: Workspace SHALL keep a consistent refreshed visual system across Home and Settings tabs
系统 MUST 在新增底部 Tab 壳层后，保持首页工作台、设置页和底部导航都遵循同一套刷新后的视觉系统。首页与设置页中的容器、列表项、图标按钮、菜单浮层和底部 Tab 状态 MUST 继续建立在统一的 React Native Paper 组件语义与主题 token 之上，而不是引入独立的第二套视觉语言。

#### Scenario: Render Home and Settings with the same visual system
- **WHEN** 用户在首页 Tab 与设置 Tab 之间切换
- **THEN** 系统 MUST 让两个页面保持一致的背景基调、表面层级、圆角、边框和交互反馈风格

#### Scenario: Keep the active tab state visually legible
- **WHEN** 用户查看底部 Tab 导航
- **THEN** 系统 MUST 通过统一的高亮状态、图标 / 文字颜色和可读对比度清晰区分当前激活页与未激活页

#### Scenario: Present the language settings item as part of the refreshed UI
- **WHEN** 用户在设置页查看或打开语言设置项
- **THEN** 系统 MUST 让语言图标、列表项、当前语言值和下拉菜单与现有刷新后的工作台风格保持一致，而不是出现与首页脱节的控件风格

