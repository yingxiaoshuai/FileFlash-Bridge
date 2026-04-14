## ADDED Requirements

### Requirement: App SHALL provide a collapsible project history manager from the workspace header
The app SHALL provide a tappable project history entry in the workspace header. 系统必须在手机端主工作台左上角提供一个可触发的“项目历史”入口。用户打开该入口后，系统必须展示历史项目列表、当前活跃项目的选中态、每个项目的基础摘要信息，以及新建、切换和删除项目的管理操作；关闭入口后，主工作台必须恢复为默认总览态。

#### Scenario: Open project history from the workspace header
- **WHEN** 用户在主工作台左上角点击项目历史入口
- **THEN** 系统必须展开历史项目管理层，并展示全部历史项目列表、当前活跃项目高亮态以及新建项目入口

#### Scenario: Create a new project from the history manager
- **WHEN** 用户在历史项目管理层中执行新建项目
- **THEN** 系统必须创建新项目并将其设为当前活跃项目
- **AND** 系统必须关闭历史项目管理层，并返回主工作台默认总览态

#### Scenario: Switch to a historical project and return to the workspace home
- **WHEN** 用户在历史项目管理层中选中某个历史项目
- **THEN** 系统必须将该项目切换为当前活跃项目
- **AND** 系统必须关闭历史项目管理层，并返回主工作台默认总览态

#### Scenario: Delete a project from the history manager
- **WHEN** 用户在历史项目管理层中对某个项目执行删除操作
- **THEN** 系统必须先展示现有的删除确认提示，明确说明会清除该项目数据及其关联文件
- **AND** 仅在用户确认后才可删除该项目，并刷新历史项目列表与当前活跃项目状态
