## ADDED Requirements

### Requirement: Cross-platform design tokens

系统 SHALL 提供适合 React Native Paper、iOS、Android 和 Harmony 降级路径共用的设计 token，包括语义色彩、8pt 间距、圆角、阴影、状态色、图标尺寸和动效参数。

#### Scenario: Use shared semantic colors

- **WHEN** 首页、设置页、底部 Tab 或反馈横幅引用背景、表面、主文本、次文本、强调色或状态色
- **THEN** 系统 SHALL 从共享 token 中读取颜色
- **AND** 不得在页面组件中扩散互相矛盾的硬编码主色体系

#### Scenario: Keep spacing and radii consistent

- **WHEN** 工作台卡片、列表项、按钮、图标按钮、底部 Tab 或弹窗渲染
- **THEN** 系统 SHALL 使用共享间距和圆角 token
- **AND** 常用间距 SHALL 遵循 8pt 网格或明确的半步 4pt 值

#### Scenario: Keep Paper theme aligned

- **WHEN** React Native Paper 组件渲染按钮、菜单、表面、SegmentedButtons 或反馈控件
- **THEN** Paper theme SHALL 映射到同一套项目 token
- **AND** Paper 组件不得出现与自定义组件脱节的颜色、圆角或状态反馈

### Requirement: Premium but restrained visual hierarchy

系统 SHALL 使用中性背景、清晰表面层级、克制强调色、稳定阴影和可读文本层级呈现工作台，避免廉价感、过度蓝色和杂乱按钮堆叠。

#### Scenario: Avoid blue-only cheap styling

- **WHEN** 用户查看首页、设置页、底部 Tab、项目历史、共享列表或项目内容
- **THEN** 系统 SHALL 使用中性背景和有限强调色建立层级
- **AND** 不得让大面积单一蓝色成为主要视觉基底

#### Scenario: Avoid nested decorative cards

- **WHEN** 内容工作区包含服务摘要、共享列表、消息列表或文件列表
- **THEN** 系统 SHALL 避免重复卡片套卡片和无意义装饰容器
- **AND** 只在需要组织重复项目、弹窗或关键工作区时使用卡片表面

### Requirement: Cross-platform degradation

系统 SHALL 默认通过 React Native 共享层实现视觉系统，并为 Android 和 Harmony 保持可运行降级。

#### Scenario: Avoid unverified native UI dependencies

- **WHEN** 本次 V1 UI 改造实施
- **THEN** 系统 SHALL 不要求安装 `react-native-sf-symbols`、`@react-native-community/blur` 或 `react-native-reanimated`
- **AND** 若后续需要这些能力，必须通过独立变更说明平台影响和验证计划

#### Scenario: Keep Harmony-compatible surfaces

- **WHEN** Harmony 环境不支持某个 iOS 或 Android 视觉能力
- **THEN** 系统 SHALL 使用共享颜色、边框、阴影、PNG/SVG 图标或禁用动效的方式降级
- **AND** 不得阻断文件投递、共享或项目查看功能
