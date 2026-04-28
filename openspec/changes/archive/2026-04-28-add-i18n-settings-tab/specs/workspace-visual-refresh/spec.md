## ADDED Requirements

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
