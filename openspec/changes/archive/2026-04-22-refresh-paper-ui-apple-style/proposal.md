## Why

当前 App 工作台和启动后的浏览器门户页仍大量使用自定义基础控件与偏“浅黄纸面”的旧视觉风格，界面的一致性、层级感和精致度都不足，已经开始影响项目切换、服务控制、文件上传下载和文本投递等高频操作的使用体验。现在需要把 App 主界面统一到 React Native Paper 组件体系，并让浏览器门户页同步升级为同一套更接近 Apple 风格的轻盈、克制、层次清晰的视觉语言，同时移除现有偏淡黄色的主色基调。

这次调整的目标是在不改变局域网传输、文件存储和权限流程语义的前提下，同时提升 React Native App 与浏览器门户页的质感、一致性和可维护性，为后续继续扩展传输工作流建立统一 UI 基座。

## What Changes

- 将移动端主工作台中的按钮、列表、菜单、表面容器、输入与反馈区域统一迁移到 `react-native-paper` 组件体系或以其主题能力为基础的共享封装。
- 重做 App 主工作台的视觉主题，建立新的颜色、圆角、阴影、间距和状态样式，整体风格向 Apple 质感靠拢，但保持跨平台可实现性。
- 重做浏览器门户页的 HTML/CSS 视觉主题，使上传、文本提交、共享文件下载和状态反馈与 App 主工作台保持同一风格方向。
- 移除当前主题中的淡黄色背景与表面色，改用更中性、冷白或微灰的基底色，并重新定义强调色、成功/警告/错误色。
- 升级首页、项目历史侧边栏、服务状态区、文件列表、消息列表与共享文件列表的界面层次，使结构更清晰、信息密度更平衡。
- 升级浏览器门户页的英雄区、上传区、文本区、共享下载区和反馈横幅，让网页也具备更强的层级感与苹果质感。
- 统一加载、空态、提示、危险操作和菜单操作的视觉语言，减少自定义控件样式分叉。
- 保持现有传输能力、文件导入导出、项目管理、权限流程和浏览器门户核心行为不变；本次不引入新的传输协议或存储结构。

## Capabilities

### New Capabilities
- `workspace-visual-refresh`: 定义 App 工作台与浏览器门户页共享的 Apple 风格视觉语言、非淡黄色主题基线和统一状态反馈规范。

### Modified Capabilities
- `local-transfer-server`: 调整主工作台在服务控制、项目历史、消息/文件列表等区域的界面呈现要求，以匹配新的 Paper 组件体系和视觉规范，但不改变传输能力本身。
- `web-transfer-portal`: 调整浏览器门户页的视觉主题、布局层级和状态反馈要求，使其与新的视觉系统一致，但不改变上传、文本提交和下载能力本身。

## Impact

- 受影响代码主要集中在 [App.tsx](d:\company\FileFlash-Bridge\App.tsx)、[theme.ts](d:\company\FileFlash-Bridge\src\app\theme.ts)、[portalDocument.ts](d:\company\FileFlash-Bridge\src\modules\portal\portalDocument.ts) 以及与工作台视觉样式相关的共享组件/样式代码。
- 预计继续扩展 `react-native-paper` 的使用范围，并可能补充共享的 Paper 包装组件或主题映射，不需要新增自定义 Native Module。
- 需要更新 `openspec/specs/local-transfer-server/spec.md`、`openspec/specs/web-transfer-portal/spec.md`，并新增 `workspace-visual-refresh` capability spec。
- 需要补充共享代码测试与门户页输出验证，确保视觉升级不影响现有项目切换、服务控制、文件上传下载、文本提交和删除确认等关键交互。
