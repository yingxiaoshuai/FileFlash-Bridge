# FileFlash-Bridge Mobile

中文版: [README.md](./README.md)

FileFlash-Bridge is a **React Native 0.85** + **TypeScript** mobile app for local network transfer between a browser and a phone.

Once the app starts its local HTTP service, devices on the same Wi-Fi or hotspot can open the portal page in a browser and:

- send text from the browser to the phone
- upload files from the browser to the phone
- download selected shared files from the phone back to the browser

The repository already includes Android local development support, Android GitHub Release automation, and a maintained in-repo React Native HTTP bridge module.

## Highlights

| Capability | Description |
|------|------|
| Local transfer service | Detects reachable LAN addresses, shows the access URL and QR code, and supports simple / secure mode, access keys, and connection limits. |
| Browser portal | Responsive built-in portal page for text submission, direct small-file upload, chunked large-file upload, shared file listing, and chunked download. |
| Session storage | Stores inbound content inside the app session directory. Small text-like payloads may be compressed, while large and binary files keep their original bytes. |
| Export and sharing | Files can be exported through the system document picker or shared to other apps. |
| Security controls | In secure mode the URL carries a `key`. Refreshing the address also refreshes the current access key. |

## Documentation

- Chinese Android release guide: [docs/github-actions-android-release.md](./docs/github-actions-android-release.md)
- English Android release guide: [docs/github-actions-android-release.en.md](./docs/github-actions-android-release.en.md)
- Android wireless debugging guide: [docs/android-wireless-debugging.md](./docs/android-wireless-debugging.md)
- OpenSpec design and requirements: `openspec/changes/launch-fileflash-bridge-v1/`

## Requirements

- **Node.js**: **22.13.0** is recommended to match the current GitHub Actions environment.
- **Android**: JDK 17, Android SDK, Build Tools 36, and NDK 27. Android Studio is recommended.
- **iOS**: Xcode, CocoaPods, and Bundler are required for local iOS builds.
- **Windows**: the repo is already set up for `gradlew.bat` workflows in PowerShell.

## Quick Start

Install dependencies first:

```bash
npm install
```

### Start Metro and Android Debug

Using two terminals is recommended:

```bash
# Terminal 1
npm run start
```

```bash
# Terminal 2
npm run android
```

It is usually more reliable to start the emulator manually, or connect a physical device first, and then run `npm run android`.

If you run the app inside an emulator but want to open the portal from the host browser, see:

- [docs/android-wireless-debugging.md](./docs/android-wireless-debugging.md)

## Common Scripts

| Command | Description |
|------|------|
| `npm run start` | Starts the Metro bundler. |
| `npm run android` | Builds and installs the Android debug app. |
| `npm run ios` | Runs the iOS app in a macOS + Xcode environment. |
| `npm run test:unit` | Runs Jest unit tests. |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm run lint` | Runs ESLint. |
| `npm run android:apk` | Builds the Android release APK on Windows. |
| `npm run icons:generate` | Regenerates Android and iOS app icons from the root `app.png`. |

### Release Builds

If you only want a local release APK:

```powershell
npm run android:apk
```

If you want an `AAB` for store delivery:

```powershell
cd android
.\gradlew.bat bundleRelease
```

If you want automated GitHub releases, see:

- [docs/github-actions-android-release.md](./docs/github-actions-android-release.md)
- [docs/github-actions-android-release.en.md](./docs/github-actions-android-release.en.md)

## Repository Layout

```text
FileFlash-Bridge/
  App.tsx
  android/
  ios/
  docs/
  openspec/
  packages/
    fileflash-static-server/
  src/
    app/
    modules/
      file-access/
      portal/
      security/
      service/
    test-support/
```

Key areas:

- `App.tsx`: main application UI.
- `src/modules/service/`: LAN service, HTTP runtime, connection management, and security logic.
- `src/modules/file-access/`: session storage, compression, import/export, and React Native filesystem adapters.
- `src/modules/portal/`: browser portal HTML and client-side logic.
- `packages/fileflash-static-server/`: the maintained in-repo React Native HTTP bridge module.
- `docs/`: supporting docs for debugging and release workflows.

## Key Dependencies

- `@fileflash/react-native-static-server`
  Maintained in-repo local HTTP bridge that forwards browser requests into the React Native JS layer.
- `@react-native-documents/picker`
  System file selection and save/export support.
- `react-native-share`
  System sharing flows for export.
- `react-native-fs`
  Session file IO, chunk upload persistence, export, and copy operations.
- `@react-native-community/netinfo`
  Wi-Fi / hotspot state and address discovery.
- `react-native-qrcode-svg` + `react-native-svg`
  QR code rendering for the access URL.
- `pako`
  Compression and decompression on mobile, paired with `zlib` in tests.

## Android Notes

- The Android project currently targets **compileSdk 36**.
- Large browser uploads automatically switch to chunked upload endpoints.
- Refreshing the address in the app also refreshes the current access key.
- When debugging with an AVD and opening the portal from the host browser, `adb forward` is usually required.
- The icon source file is `app.png` in the repository root. Run `npm run icons:generate` after replacing it.

### Access the emulator service from the host browser

If the service inside the app currently runs on port `8668`:

```bash
adb forward tcp:8668 tcp:8668
```

Then open this in the host browser:

```text
http://127.0.0.1:8668
```

If secure mode is enabled, copy the full URL from the app and replace only the host with `127.0.0.1`.

## iOS Notes

- For a first local iOS setup, run:

```bash
bundle install
bundle exec pod install
```

- The iOS project already has the base integration direction for local-network features, but the current release workflow is focused on Android.
- If a full iOS release flow is added later, it is a good idea to document it separately.

## Testing and Quality Checks

Before committing, it is recommended to run at least:

```bash
npm run test:unit
npm run typecheck
```

Optionally:

```bash
npm run lint
```

## FAQ

### 1. I see Node engine warnings during `npm install`

React Native 0.85 is stricter about Node versions. Using **Node 22.13.0** is the safest option here.

### 2. Android install fails or the device is not detected

Run `adb devices` first and make sure the target device is listed as `device`.

### 3. Metro cannot connect to the phone

Check network connectivity, or use:

```bash
adb reverse tcp:8081 tcp:8081
```

### 4. The browser cannot reach the portal page

Check that:

- the service is started in the app
- the IP and port match the current app screen
- after switching Wi-Fi or hotspot, you refreshed the address in the app

### 5. GitHub Release did not trigger automatically

Make sure you pushed a tag such as `v0.0.1`, and that all required GitHub Secrets are configured.

## License

See [LICENSE](./LICENSE).
