# Android 真机无线调试（React Native / Metro）

无线调试分为两部分，可按需只做其一或全部配置：

1. **Metro 走 Wi‑Fi**：不插 USB 也能加载 JS、热更新（开发时最常用）。
2. **ADB 无线连接**：不插线执行 `npm run android`、`adb logcat` 等。

---

## 一、Metro 通过 Wi‑Fi 连接（必做项）

适用于：手机已能装上 Debug 包，希望**不再依赖** `adb reverse tcp:8081`。

### 步骤

1. **同一网络**  
   手机与电脑连接**同一 Wi‑Fi**。  
   注意：若用手机热点，需确认电脑连的是该热点，且能互访（部分机型/运营商会隔离客户端）。

2. **查询电脑局域网 IP**（Windows PowerShell）：

   ```powershell
   ipconfig
   ```

   在「无线局域网适配器 WLAN」下查看 **IPv4 地址**（例如 `192.168.1.23`）。

3. **启动 Metro**（项目根目录）：

   ```powershell
   npm run start
   ```

4. **防火墙**  
   允许 **TCP 8081** 入站（Node / Java 或端口规则）。若暂时无法判断，可先关闭专用网络防火墙做连通性测试。

5. **手机端配置 Bundle 地址**  
   - 打开 App，**摇一摇**（或使用系统提供的开发菜单快捷键）打开 **Dev Menu**。  
   - 进入 **Settings（设置）** → **Debug server host for device**（调试服务器主机与端口）。  
   - 填写：`你的电脑IP:8081`  
     - 示例：`192.168.1.23:8081`  
     - **不要**加 `http://` 前缀。  
   - 返回开发菜单，执行 **Reload**。

完成后，JS 会从 `http://<电脑IP>:8081` 加载，**无需 USB 反向代理**。

---

## 二、ADB 无线连接（可选，Android 11+ 推荐）

适用于：希望**不插 USB** 执行 `npm run android`、安装 APK、`adb logcat` 等。

### Android 11 及以上（无线调试）

1. 手机：**开发者选项** → **无线调试** → 开启。  
2. 进入 **使用配对码配对设备**，记下 **IP、配对端口、配对码**。  
3. 电脑执行：

   ```powershell
   adb pair <配对界面显示的IP>:<配对端口>
   ```

   按提示输入配对码。  
4. 返回无线调试主界面，查看 **IP 地址和端口**（调试端口，通常与配对端口不同），执行：

   ```powershell
   adb connect <手机IP>:<调试端口>
   adb devices
   ```

   列表中出现 `device` 即表示已通过 Wi‑Fi 连接。

之后可在该状态下运行：

```powershell
npm run android
```

### 旧系统（无「无线调试」菜单）

需**至少 USB 连接一次**：

```powershell
adb tcpip 5555
adb connect <手机IP>:5555
```

拔掉 USB 后仍可用 `adb connect` 维持连接（手机重启或网络变化后可能需重连）。

---

## 三、常见问题

| 现象 | 处理建议 |
|------|----------|
| 红屏 / 无法连接 bundle | 核对 **Debug server host** 是否为 `IP:8081`；电脑 Metro 是否已启动；**防火墙是否放行 8081**；是否与电脑同网段。 |
| 无线 ADB 频繁断开 | 重开手机「无线调试」；再次执行 `adb connect`；检查路由器是否开启 AP 隔离。 |
| 公司/校园网无法互通 | 换可互通的 Wi‑Fi，或使用手机热点（注意电脑必须连该热点且获得正确网段）。 |

---

## 四、与「远程调试」JS 的关系

当前 React Native（Hermes）推荐使用 **React Native DevTools**：在运行 Metro 的终端按 **`j`** 打开调试界面，而不是依赖旧版 Chrome Remote JS Debugging。

查看原生日志示例：

```powershell
adb logcat *:S ReactNative:V ReactNativeJS:V
```

（无线 ADB 连接成功后同样适用。）

---

*文档对应工程：FileFlash-Bridge（React Native）。*
