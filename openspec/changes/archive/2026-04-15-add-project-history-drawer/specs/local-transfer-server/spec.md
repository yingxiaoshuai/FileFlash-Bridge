## ADDED Requirements

### Requirement: App SHALL provide a project history sidebar using React Native Paper Drawer
系统 MUST 在主工作台中提供一个项目历史侧边栏，并使用 React Native Paper Drawer 组件体系展示项目列表与当前活跃项目状态。宽屏下侧边栏必须位于主内容左侧；窄屏下系统必须通过顶部菜单图标打开一个真正从左侧出现的 Drawer 式边栏，而不是把项目历史直接堆叠到主内容上方。窄屏 Drawer 必须在安全区域内展开，不得覆盖或改变状态栏。项目历史必须以列表行形式展示项目名称、创建日期和文件数等摘要，而不是卡片块。侧边栏头部必须仅提供标题与右上角“新建”入口，不得出现额外关闭按钮或全局“删除当前项目”按钮。项目删除必须通过对应项目行尾部的 `...` 菜单触发，且侧边栏不得包含“启动服务”或“选文件”入口。

#### Scenario: View project history in the workspace sidebar
- **WHEN** 用户打开主工作台
- **THEN** 系统必须展示项目历史侧边栏，或在窄屏下允许用户打开左侧 Drawer 式边栏
- **AND** 系统必须在其中以列表行显示历史项目与当前活跃项目高亮态
- **AND** 窄屏下侧边栏外部入口必须是单个菜单图标按钮，侧边栏内部不得再出现关闭按钮

#### Scenario: Keep service and file import actions in the workspace home
- **WHEN** 用户查看项目历史侧边栏
- **THEN** 系统不得在其中展示“启动服务”或“选文件”操作
- **AND** 这些操作必须继续保留在主页工作区卡片中

#### Scenario: Create a new project from the sidebar
- **WHEN** 用户在项目历史侧边栏中执行新建项目
- **THEN** 系统必须创建新项目并将其设为当前活跃项目
- **AND** 工作台摘要、消息列表与文件列表必须立即切换到该项目

#### Scenario: Switch to a historical project from the drawer list
- **WHEN** 用户在 Drawer 项目列表中选中某个历史项目
- **THEN** 系统必须将该项目切换为当前活跃项目
- **AND** 侧边栏中的活跃态、顶部摘要、消息列表、文件列表和共享文件项目跳转都必须指向新的活跃项目

#### Scenario: Delete a project from the sidebar row menu
- **WHEN** 用户在某个项目行尾部打开 `...` 菜单并执行删除
- **THEN** 系统必须先展示现有的删除确认提示，明确说明会清除该项目数据及其关联文件
- **AND** 仅在用户确认后才可删除该项目
- **AND** 删除完成后系统必须刷新活跃项目状态与侧边栏项目列表
