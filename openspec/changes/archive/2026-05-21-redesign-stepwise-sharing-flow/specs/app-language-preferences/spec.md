## ADDED Requirements

### Requirement: Language switch entry SHALL show the alternate target language
系统 MUST 在默认可见的语言切换入口中展示可切换到的目标语言，而不是把当前语言作为主要按钮文案。当前 App 语言为中文时，入口 MUST 显示 `English`；当前 App 语言为英文时，入口 MUST 显示 `中文`。该入口 MAY 位于设置页、首页辅助操作区或既有语言设置项中，但 MUST 保持与当前视觉系统一致。

#### Scenario: Chinese UI shows English as the switch target
- **GIVEN** App 当前语言偏好为 `zh-CN`
- **WHEN** 用户查看默认可见的语言切换入口
- **THEN** 系统 MUST 显示 `English` 作为可切换目标
- **AND** 不得把 `中文` 作为该入口的主要按钮文案

#### Scenario: English UI shows Chinese as the switch target
- **GIVEN** App 当前语言偏好为 `en-US`
- **WHEN** 用户查看默认可见的语言切换入口
- **THEN** 系统 MUST 显示 `中文` 作为可切换目标
- **AND** 不得把 `English` 作为该入口的主要按钮文案

#### Scenario: Tapping the target language switches immediately or opens an equivalent selector
- **WHEN** 用户点击默认可见的语言切换入口
- **THEN** 系统 MUST 允许用户切换到该入口所显示的目标语言
- **AND** 如果实现仍展示菜单或弹层，菜单 MUST 清晰标记当前语言和目标语言，不得让用户无法判断将切换到哪种语言
