## ADDED Requirements

### Requirement: Workspace SHALL provide a skippable first-run onboarding tour
移动端工作台 MUST 在用户首次进入工作台且本地尚未记录当前引导版本已完成或已跳过时，展示页面内分步式新手引导。该引导 MUST 逐步说明服务启动、访问地址/二维码、共享文件区域和当前项目区域的用途，并提供“上一步”“下一步”“跳过”“完成”等显式操作。引导 MUST 仅用于解释现有控件：通过框选/高亮与文案告诉用户“在哪里、怎么用”，但不在引导里提供任何真实业务操作能力，也不得替用户自动触发服务启动、权限申请、地址刷新、文件导入、项目切换或任何其它业务动作；在完成或跳过后，系统 MUST 在本地记忆当前版本状态。

#### Scenario: Show the first step when the workspace opens for a first-time user
- **WHEN** 用户首次打开移动端工作台且当前引导版本没有本地完成/跳过记录
- **THEN** 系统必须自动展示工作台新手引导的第一步，并高亮当前步骤对应的核心区域

#### Scenario: Skip the tour and suppress future auto-open for the same version
- **WHEN** 用户在工作台新手引导中点击“跳过”或关闭引导
- **THEN** 系统必须立即退出引导并在本地记录当前版本已跳过
- **AND** 用户后续再次进入工作台时，系统不得重复自动弹出同一版本的新手引导

#### Scenario: Complete the tour without mutating business state
- **WHEN** 用户在工作台新手引导的最后一步点击“完成”
- **THEN** 系统必须关闭引导并在本地记录当前版本已完成
- **AND** 工作台现有的服务控制、共享文件、消息列表和文件列表状态必须保持原样，不得因为完成引导而被自动修改

#### Scenario: Do not require real operations inside the tour
- **WHEN** 用户在工作台新手引导中切换步骤或阅读说明
- **THEN** 系统不得要求用户在引导期间执行真实操作（如点击启动服务、上传文件或切换模式）才能继续下一步

#### Scenario: Reopen the tour from an explicit workspace entry
- **WHEN** 用户在工作台中触发“重新查看引导”或等价帮助入口
- **THEN** 系统必须从第一步重新打开当前版本的新手引导，即使该用户此前已经完成或跳过

#### Scenario: Keep the onboarding interaction safe on iOS and Android
- **WHEN** 工作台新手引导在 iOS 或 Android 的常见窄屏布局中展示
- **THEN** 系统必须保证步骤控件位于安全区内且可点击
- **AND** 在 Android 上，硬件返回操作必须优先用于关闭引导或回退引导步骤，而不是直接离开当前工作台
