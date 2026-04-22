## MODIFIED Requirements

### Requirement: App SHALL provide a project history sidebar using React Native Paper Drawer
系统 MUST 在主工作台中提供一个项目历史侧边栏，并使用 React Native Paper Drawer 组件体系展示项目列表与当前活跃项目状态。宽屏下侧边栏必须位于主内容左侧；窄屏下系统必须通过顶部菜单图标打开一个真正从左侧出现的 Drawer 式边栏，而不是把项目历史直接堆叠到主内容上方。窄屏 Drawer 必须在安全区域内展开，不得覆盖或改变状态栏。项目历史必须以列表行形式展示项目名称、创建日期和文件数等摘要，而不是卡片块；其表面、边框、间距、菜单和头部操作必须与新的 Paper 工作台主题保持一致，不得残留旧的浅黄色背景或旧式自定义卡片风格。侧边栏头部必须仅提供标题与右上角“新建”入口，不得出现额外关闭按钮或全局“删除当前项目”按钮。项目删除必须通过对应项目行尾部的 `...` 菜单触发，且侧边栏不得包含“启动服务”或“选文件”入口。

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

## ADDED Requirements

### Requirement: App SHALL present transfer operations through the refreshed Paper workspace
系统 MUST 在主工作台中通过新的 Paper 化界面承载服务启停、地址展示、文件导入、共享文件浏览、消息浏览、文件浏览、复制、导出与共享切换等核心操作。界面重构后，这些操作必须继续在共享代码中保持一致的信息架构和可发现性，不得因视觉升级而被隐藏、分散或弱化。

#### Scenario: Operate the service and file import from the refreshed home workspace
- **WHEN** 用户在主工作台首页查看服务控制区与文件导入区
- **THEN** 系统必须继续提供启动/停止服务、查看访问地址、复制链接和选择文件等操作，并以新的 Paper 主题和层级方式呈现

#### Scenario: Browse text and file content within the refreshed workspace
- **WHEN** 用户打开当前活跃项目并查看消息列表、文件列表或共享文件列表
- **THEN** 系统必须继续展示与现有功能等价的项目内容和操作入口，同时使这些列表在视觉上符合新的统一主题

#### Scenario: Preserve operational feedback after the UI refresh
- **WHEN** 文件上传完成、文本提交成功、共享切换失败、导出失败或权限/网络状态阻塞操作
- **THEN** 系统必须继续在 App 工作台中清晰提示结果、失败原因和后续可执行动作，而不得因为界面升级削弱反馈
