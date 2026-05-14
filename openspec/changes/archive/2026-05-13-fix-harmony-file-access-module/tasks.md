## 1. 运行时定位

- [x] 1.1 在鸿蒙启动日志中确认 `PackageProvider.ets` 被 `Index.ets` 使用，且 `FPFileAccessPackage` 被创建。
- [x] 1.2 在 `FPFileAccessPackage` 的 `hasTurboModule` 与 `createTurboModule` 增加临时诊断日志，验证运行时是否请求 `FPFileAccess`。
- [x] 1.3 在 JS 文件适配器中增加受控诊断，区分 `NativeModules.FPFileAccess`、`TurboModuleRegistry.get('FPFileAccess')` 和旧 bundle 路径。
- [ ] 1.4 在当前鸿蒙设备/模拟器复现截图中的 toast，记录使用的 HAP 路径、bundle 时间戳和运行日志。

## 2. 鸿蒙原生文件桥修复

- [x] 2.1 确保 `FPFileAccessTurboModule` 实现 `copyFile`、`readFile`、`readFileChunk`、`writeFile`、`appendFile`、`saveFileToDocuments` 六个 JS 需要的接口。
- [x] 2.2 将鸿蒙文件写入和追加统一为 `Uint8Array`/`ArrayBuffer` 入参，不接受大文件 base64 写入路径。
- [x] 2.3 将鸿蒙文件复制和系统保存改为固定大小分块复制，并在完成后校验目标文件大小。
- [x] 2.4 修正用户取消系统保存器、源文件不可读、目标不可写和空间不足时的错误分类，避免误报模块缺失。

## 3. React Native 共享层修复

- [x] 3.1 将鸿蒙 `FPFileAccess` 获取改为按操作懒加载，启动早期获取失败不得永久缓存空模块。
- [x] 3.2 确保鸿蒙上传、读取分块、导出准备文件和共享文件下载均传递 `Uint8Array`，不在鸿蒙大文件路径中生成 base64。
- [x] 3.3 保留 iOS 与 Android 既有 RNFS/系统保存路径，并增加回归测试防止共享层修改影响两端。
- [x] 3.4 修复 Android 浏览器向鸿蒙设备上传 JSON 返回 500 的路径，确保 `/api/upload` 对 JSON 文件保持原始字节体。

## 4. 系统共享入口修复

- [x] 4.1 将 `ShareInbox.ets` 中的共享文件接收从同步复制改为后台异步分块复制。
- [x] 4.2 增加共享导入 `copying` 标记和 `pending` manifest 完成标记，JS 消费前等待复制完成。
- [x] 4.3 处理共享 URI 不可直接读取的失败路径，清理半成品缓存并展示可恢复提示。
- [ ] 4.4 使用大文件从系统文件管理器共享到 App，验证 App 不再卡死且导入完成后文件可加入分享列表。

## 5. 打包与加载一致性

- [x] 5.1 调整鸿蒙入口，验收和发布路径固定使用 HAP 内置 `bundle.harmony.js`，避免旧 Metro bundle 覆盖。
- [x] 5.2 更新鸿蒙打包脚本或验证步骤，要求 JS 变更后先执行 `npm run harmony:bundle` 再构建安装。
- [x] 5.3 构建后检查 `bundle.harmony.js` 包含 `FPFileAccess` 懒加载逻辑，并确认不包含旧的鸿蒙大文件 base64 写入逻辑。
- [x] 5.4 分别验证 debug HAP 和 release HAP 均包含 `FPFileAccess` 原生模块和最新内置 bundle。

## 6. 自动化验证

- [x] 6.1 补充 `reactNativeAdapters` 单测，覆盖鸿蒙模块缺失、模块延迟可用、字节写入、分块读取和系统保存。
- [x] 6.2 补充 HTTP runtime 或 transfer controller 单测，覆盖 JSON 文件上传保持 `Uint8Array`，且失败不会生成半写入记录。
- [x] 6.3 执行 `npm test -- --runInBand __tests__/reactNativeAdapters.test.ts __tests__/reactNativeHttpRuntime.test.ts __tests__/transferServiceController.test.ts`。
- [x] 6.4 执行 `npm run typecheck`，确保共享 TypeScript 修改不破坏 iOS/Android/Harmony 编译。

## 7. 真机与端到端验收

- [ ] 7.1 执行 `npm run harmony:bundle` 和鸿蒙 HAP 构建安装，在设备上确认不再显示 `FPFileAccess` 缺失 toast。
- [ ] 7.2 从 Android 浏览器向鸿蒙设备上传 JSON 文件和大文件，验证 HTTP 响应成功、App 内文件大小正确、浏览器端不报 500。
- [ ] 7.3 在鸿蒙 App 内导出一个大文件到系统文件位置，验证目标文件能打开且大小与源文件一致。
- [ ] 7.4 从鸿蒙系统文件管理器共享一个大文件到 App，验证 App 不卡死、导入完成、缓存清理正常。
- [ ] 7.5 在 iOS 和 Android 上执行文件选择、上传、导出和权限流程冒烟验证，确认共享代码改动未造成回归。
- [ ] 7.6 记录最终验证命令、设备型号/模拟器版本、HAP 路径和剩余已知限制。
