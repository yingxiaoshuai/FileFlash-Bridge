## ADDED Requirements

### Requirement: Lightweight native-feeling motion

系统 SHALL 提供轻量、可降级、跨平台的动效参数，用于按压反馈、面板出现和状态切换。

#### Scenario: Button press feedback

- **WHEN** 用户按下启动服务入口或高频操作按钮
- **THEN** 系统 SHALL 提供短促、克制的按压反馈
- **AND** 可原生驱动的动画 SHALL 使用 `useNativeDriver: true`

#### Scenario: Reveal content workspace after startup

- **WHEN** 服务从未启动进入可访问状态
- **THEN** 内容与共享工作区 SHALL 使用轻量淡入、位移或等效过渡出现
- **AND** 服务摘要 SHALL 不产生突兀跳动或遮挡

### Requirement: Motion shall not harm platform compatibility

动效 SHALL 不依赖 V1 未引入的 Reanimated 或复杂原生手势能力，并可在性能不足或 Harmony 降级时关闭或简化。

#### Scenario: Run without Reanimated

- **WHEN** 应用未安装 `react-native-reanimated`
- **THEN** 本次 UI 改造 SHALL 仍可构建和运行
- **AND** 基础按压反馈和页面状态切换 SHALL 使用 React Native / Paper 可用能力实现

#### Scenario: Degrade on lower capability platforms

- **WHEN** 设备性能不足、平台不支持某些动画能力或 Harmony 降级路径启用
- **THEN** 系统 SHALL 简化或关闭动效
- **AND** 不得影响服务启动、文件投递、项目查看和共享管理

### Requirement: Operational feedback remains visible

系统 SHALL 在当前步骤附近或统一反馈区展示服务、网络、导入、导出和共享状态变化。

#### Scenario: Show failure in the active step

- **WHEN** 服务启动失败、网络不可达、文件导入失败、文件导出失败或共享切换失败
- **THEN** 系统 SHALL 在用户当前操作上下文附近展示结果、原因和恢复动作
- **AND** 克制视觉风格不得削弱错误或警告状态的可感知性

#### Scenario: Preserve success feedback

- **WHEN** 浏览器上传文件、提交文本、复制链接、导入文件、导出保存或共享状态切换成功
- **THEN** 系统 SHALL 继续展示成功反馈
- **AND** 用户 SHALL 能看到内容列表或共享状态发生了对应变化
