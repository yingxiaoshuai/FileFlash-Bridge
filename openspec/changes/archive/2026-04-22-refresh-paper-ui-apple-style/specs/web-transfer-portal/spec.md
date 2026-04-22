## MODIFIED Requirements

### Requirement: Browser portal SHALL present a responsive transfer workspace
系统 MUST 提供一个可由桌面和移动浏览器访问的响应式页面，展示当前设备名称、连接状态、文件上传区、**手机端已共享文件的下载区**、文本粘贴区和主要操作入口。页面必须在无需安装任何客户端的前提下完成向手机投递文件、从手机取回已共享文件、以及提交文本内容的核心流程。门户页的整体视觉风格必须与 App 主工作台保持一致，采用中性冷白或微灰的背景与表面基底、清晰的区块层级、统一的按钮和反馈样式，不得继续使用旧的浅黄色纸面风格。

#### Scenario: Open portal from desktop browser
- **WHEN** 用户在电脑浏览器中访问 App 展示的局域网地址
- **THEN** 系统必须返回可正常渲染的门户页面，并显示设备信息、文件上传区、共享文件下载区和文本提交区
- **AND** 页面必须以新的统一视觉主题呈现 hero、内容卡片和主要操作

#### Scenario: Open portal from mobile browser
- **WHEN** 用户在另一台手机或平板浏览器中访问该地址
- **THEN** 页面必须根据窄屏布局调整操作区，仍可完成文件上传、共享文件下载与文本内容投递
- **AND** 页面在窄屏下仍必须保持与 App 一致的视觉层级和状态反馈样式

## ADDED Requirements

### Requirement: Browser portal MUST provide Apple-inspired transfer feedback
系统 MUST 在门户页中以与 App 主工作台一致的视觉语言展示等待上传、上传中、文本提交中、下载中、成功、警告、错误和离线等状态，使浏览器用户在每个传输阶段都能获得清晰反馈。该反馈必须通过统一的横幅、状态卡片、列表状态或等价 UI 结构呈现。

#### Scenario: Portal is ready for incoming content
- **WHEN** 浏览器门户成功加载但用户尚未选择文件或输入文本
- **THEN** 页面必须展示清晰的空闲态提示，引导用户上传文件、从共享列表下载或粘贴文本
- **AND** 这些空闲态提示必须符合新的统一视觉风格

#### Scenario: Show consistent visual feedback during transfer
- **WHEN** 浏览器用户上传文件、提交文本、下载共享文件或遇到连接失败
- **THEN** 页面必须通过统一的状态样式展示当前进度、成功结果或失败原因，而不得出现旧样式与新样式混用的情况
