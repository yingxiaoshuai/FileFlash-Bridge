# web-transfer-portal Specification

## Purpose
TBD - created by archiving change launch-fileflash-bridge-v1. Update Purpose after archive.
## Requirements
### Requirement: Browser portal SHALL present a responsive transfer workspace
系统必须提供一个可由桌面和移动浏览器访问的响应式页面，展示当前设备名称、连接状态、文件上传区、**手机端已共享文件的下载区**、文本粘贴区和主要操作入口。页面必须在无需安装任何客户端的前提下完成向手机投递文件、从手机取回已共享文件、以及提交文本内容的核心流程。

#### Scenario: Open portal from desktop browser
- **WHEN** 用户在电脑浏览器中访问 App 展示的局域网地址
- **THEN** 系统必须返回可正常渲染的门户页面，并显示设备信息、文件上传区、共享文件下载区和文本提交区

#### Scenario: Open portal from mobile browser
- **WHEN** 用户在另一台手机或平板浏览器中访问该地址
- **THEN** 页面必须根据窄屏布局调整操作区，仍可完成文件上传、共享文件下载与文本内容投递

### Requirement: Browser portal SHALL support uploading files to the mobile device
系统必须允许浏览器用户通过点击选择或拖拽方式上传文件，并在浏览器支持目录上传时允许上传文件夹。上传过程必须展示实时进度、成功状态和失败原因；上传后的内容必须由手机端写入 **App 内与会话绑定的内部存储**，不得误导用户以为已自动进入系统公共目录。

#### Scenario: Upload one or more files successfully
- **WHEN** 浏览器用户选择多个文件并确认上传
- **THEN** 系统必须展示每个文件的上传进度，并在完成后提示手机端已接收
- **AND** 成功提示不得声称文件已自动进入对方手机的系统「下载」或相册；应传达为保存在 **FileFlash-Bridge App 内会话**（或与产品名一致的表述），具体外部保存由手机用户在 App 内操作

#### Scenario: Upload a directory in a supported browser
- **WHEN** 浏览器支持目录上传且用户选择一个文件夹上传
- **THEN** 系统必须保留该文件夹的相对结构并将内容写入手机端 **App 内会话存储**

#### Scenario: Upload fails during transfer
- **WHEN** 上传因网络中断、空间不足或权限异常而失败
- **THEN** 页面必须提示失败原因，并允许用户重新发起上传

### Requirement: Browser portal SHALL support submitting pasted text content to the mobile device
系统必须允许浏览器用户在门户页中粘贴或输入文本内容并提交给手机。文本提交成功后，页面必须明确提示手机端已接收；若提交内容为空、超出限制或服务不可用，页面必须阻止或提示失败原因。

#### Scenario: Submit text content successfully
- **WHEN** 浏览器用户在文本区域粘贴内容并点击提交
- **THEN** 页面必须提示提交成功，并告知文本已发送到手机端接收区（由 App 侧**当前活跃文本项目**收纳，具体会话划分由手机端管理，浏览器无需选择项目）

#### Scenario: Block empty text submission
- **WHEN** 浏览器用户未输入任何文本即尝试提交
- **THEN** 页面必须阻止提交并提示需要先输入或粘贴内容

### Requirement: Browser portal MUST keep transfer feedback understandable
系统必须在等待用户操作、上传中、文本提交中、服务停止和认证失败等状态下提供明确的用户提示，不得让浏览器用户处于无反馈状态。

#### Scenario: Portal is ready for incoming content
- **WHEN** 浏览器门户成功加载但用户尚未选择文件或输入文本
- **THEN** 页面必须展示清晰的空闲态提示，引导用户上传文件、从共享列表下载（若有）或粘贴文本

#### Scenario: Service stops while portal is open
- **WHEN** App 端停止服务或服务被系统中断
- **THEN** 页面必须提示连接已断开，并提示用户等待服务恢复后重试

### Requirement: Browser portal SHALL download shared files using chunks and bounded per-chunk retries
当手机端存在共享文件时，门户必须允许用户发起下载。对于大文件，下载必须采用**分块**请求组装完整文件。每个分块请求失败时门户必须自动重试；**同一分块在首次失败后最多再重试 3 次**（单分块至多 **4** 次尝试）。若某分块用尽重试仍失败，必须中止该文件的下载并明确提示**传输失败**。

#### Scenario: User downloads a shared file successfully
- **WHEN** 共享列表中存在可下载文件且用户触发下载
- **THEN** 页面必须展示下载进度或分块推进反馈（实现可简化），并在成功结束后提供可保存的完整文件结果

#### Scenario: Per-chunk retries exhausted
- **WHEN** 某一文件分块在 **4** 次尝试内均失败
- **THEN** 页面必须停止该文件下载并提示传输失败，不得对同一分块无限重试

