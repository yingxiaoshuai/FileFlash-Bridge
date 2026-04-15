## Why

当前 App 已经有“项目历史”能力，但交互形态不稳定：这一轮原本想把它改成顶部入口 + 覆盖层，现在需求明确改为“保留/调整为侧边栏”，并开始引入 `react-native-paper` 的 Drawer 体系来承载项目切换入口。这样可以让历史项目始终停留在主工作台旁边，降低切换成本，也让后续继续扩展更多工作台导航项时有统一的侧栏组件基础。

这次改动仍然只调整共享 React Native 界面层，不修改底层项目存储、浏览器入站写入目标、共享文件下载协议和分块重试链路。

## What Changes

- 将项目历史改为主工作台左侧的响应式侧边栏，而不是左上角入口 + 覆盖层。
- 引入 `react-native-paper`，在应用根部提供 `PaperProvider`，并使用 `Drawer.Section` 配合自定义列表行和 `...` 菜单渲染项目历史导航。
- 在侧边栏中保留新建、切换、删除项目操作，并继续复用现有 `createProject`、`selectProject`、`deleteProject`。
- 在窄屏下复用同一套 Drawer 内容，但改为堆叠在主工作台上方，而不是覆盖主内容。
- 保持浏览器文本/文件仍然进入当前活跃项目，不修改持久化结构与已有服务协议。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `local-transfer-server`: 调整手机端项目历史管理为基于 React Native Paper Drawer 的侧边栏式交互，并更新项目切换/删除/新建入口的界面要求。

## Impact

- 主要影响 [App.tsx](d:\company\FileFlash-Bridge\App.tsx) 的布局与组件实现。
- 需要在依赖中加入 `react-native-paper`，并在 App 根部接入 `PaperProvider`。
- 项目管理动作仍复用 [useAppModel.ts](d:\company\FileFlash-Bridge\src\app\useAppModel.ts)。
