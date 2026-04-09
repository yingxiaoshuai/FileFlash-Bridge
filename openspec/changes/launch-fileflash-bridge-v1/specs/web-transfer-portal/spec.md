## ADDED Requirements

### Requirement: Browser portal SHALL present a responsive file transfer workspace
系统必须提供一个可由桌面和移动浏览器访问的响应式页面，展示当前设备名称、连接状态、已授权目录中的文件列表和主要传输操作入口。页面必须在无需安装任何客户端的前提下完成核心下载与上传流程。

#### Scenario: Open portal from desktop browser
- **WHEN** 用户在电脑浏览器中访问 App 展示的局域网地址
- **THEN** 系统必须返回可正常渲染的传输页面，并显示设备信息和可操作文件区域

#### Scenario: Open portal from mobile browser
- **WHEN** 用户在另一台手机或平板浏览器中访问该地址
- **THEN** 页面必须根据窄屏布局调整操作区，仍可完成浏览与传输

### Requirement: Browser portal SHALL support uploading files to the mobile device
系统必须允许浏览器用户通过点击选择或拖拽方式上传文件，并在浏览器支持目录上传时允许上传文件夹。上传过程必须展示实时进度、成功状态和失败原因；上传后的内容必须写入用户在 App 中授权的目标目录。

#### Scenario: Upload one or more files successfully
- **WHEN** 浏览器用户选择多个文件并确认上传
- **THEN** 系统必须展示每个文件的上传进度，并在完成后将文件写入目标目录

#### Scenario: Upload a directory in a supported browser
- **WHEN** 浏览器支持目录上传且用户选择一个文件夹上传
- **THEN** 系统必须保留该文件夹的相对结构并将内容写入目标目录

#### Scenario: Upload fails during transfer
- **WHEN** 上传因网络中断、空间不足或权限异常而失败
- **THEN** 页面必须提示失败原因，并允许用户重新发起上传

### Requirement: Browser portal MUST keep transfer feedback understandable
系统必须在文件浏览为空、上传中、下载准备中、服务停止和认证失败等状态下提供明确的用户提示，不得让浏览器用户处于无反馈状态。

#### Scenario: Portal has no files to show
- **WHEN** 已授权目录为空或当前没有可展示文件
- **THEN** 页面必须展示空状态说明，而不是空白区域

#### Scenario: Service stops while portal is open
- **WHEN** App 端停止服务或服务被系统中断
- **THEN** 页面必须提示连接已断开，并提示用户等待服务恢复后重试
