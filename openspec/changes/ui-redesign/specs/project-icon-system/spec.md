## ADDED Requirements

### Requirement: Project-local icon system

系统 SHALL 使用项目本地图标抽象提供高频工具图标，不依赖不存在或未验证的外部 SF Symbols / Material Icons 原生包。

#### Scenario: Render icons through AppIcons

- **WHEN** 首页、设置页、底部 Tab、项目历史、共享列表或项目内容需要工具图标
- **THEN** 系统 SHALL 通过 `src/app/icons/AppIcons*.tsx` 或等价项目本地图标封装渲染
- **AND** 不得要求安装 `react-native-sf-symbols`

#### Scenario: Provide platform fallback

- **WHEN** iOS、Android 或 Harmony 渲染同一工具图标
- **THEN** 系统 SHALL 提供功能等效的本地图标或降级图标
- **AND** 图标缺失时不得回退为难以理解的任意字符

### Requirement: Replace text glyph utility controls

系统 SHALL 将高频文字符号工具按钮替换为统一图标按钮，同时保留关键动作的文字确认。

#### Scenario: Replace utility glyphs

- **WHEN** 显示菜单、帮助、添加、关闭、复制、刷新、分享、下载、更多或删除等工具操作
- **THEN** 系统 SHALL 优先显示统一图标或图标加极短标签
- **AND** 不得继续依赖 `☰`、`?`、`+`、`×` 等孤立文字符号作为主要视觉表达

#### Scenario: Preserve dangerous action clarity

- **WHEN** 用户删除项目、删除文件、删除消息、停止服务或批量导出保存
- **THEN** 系统 SHALL 保留明确文字、确认流程或结果反馈
- **AND** 不得仅通过无说明图标执行危险或不可逆操作

### Requirement: Accessible icon controls

图标按钮 SHALL 保留可访问名称、测试标识和稳定触控尺寸。

#### Scenario: Screen reader and tests can identify icon buttons

- **WHEN** 屏幕阅读器、自动化测试或用户视觉扫描识别图标按钮
- **THEN** 每个关键图标按钮 SHALL 提供清晰的 `accessibilityLabel`
- **AND** 每个已被测试覆盖或关键流程依赖的图标按钮 SHALL 保留稳定 `testID`

#### Scenario: Maintain touch target size

- **WHEN** 用户在手机竖屏、窄屏或横屏点击图标按钮
- **THEN** 图标按钮 SHALL 保持至少 44px 的触控区域
- **AND** 不得因图标化导致操作变得难点或拥挤
