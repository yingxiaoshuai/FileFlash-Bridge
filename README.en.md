# FileFlash-Bridge Mobile / 文件闪传桥

中文版: [README.md](./README.md)

[![Latest Release](https://img.shields.io/github/v/release/yingxiaoshuai/FileFlash-Bridge?display_name=tag&sort=semver)](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-0A84FF)](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases/latest)
[![Transfer](https://img.shields.io/badge/Transfer-LAN%20Direct-0A84FF)](https://github.com/yingxiaoshuai/FileFlash-Bridge)

Send files and text from your browser straight to your phone.

**FileFlash-Bridge** is a local-network transfer app for iPhone and Android. When your phone and computer are on the same Wi-Fi or hotspot, just open the app, scan the QR code, and send files from a browser to your phone, or download shared files from your phone back to your computer.

**No cable. No account login. No extra desktop client.**

## Download

- iOS: open the App Store and search for **文件闪传桥**
- [Download the latest Android APK](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases/latest/download/app-release.apk)
- [See all releases and update notes](https://github.com/yingxiaoshuai/FileFlash-Bridge/releases)
- [Privacy Policy](./docs/privacy-policy-zh.md)

> iOS is available through the App Store. Android releases on GitHub include a signed `APK`, `AAB`, and `SHA256SUMS.txt` for installation and verification.
>
> For Android phones, download `app-release.apk` first.

## Why People Download It

- **Browser to phone, directly**: if your computer has a browser, it can send text and files without installing another desktop tool.
- **Start with a quick scan**: the app shows a URL and QR code so the connection flow stays simple.
- **Large files are supported**: uploads and downloads can use chunked transfer to reduce failure rates on bigger files.
- **Easy round-trip transfer**: files on the phone can be added to the share list and downloaded back in a browser.
- **Useful for team analysis**: share the same batch of files so multiple teammates can download, inspect, and analyze them separately.
- **Built for LAN workflows**: ideal for offices, labs, on-site testing, and demo environments on the same Wi-Fi or hotspot.
- **Faster file pickup**: LAN transfer avoids an extra cloud relay step, so downloads are often more direct.
- **No unnecessary mobile data usage**: on the same local network, you do not need to push files through a public cloud drive first.
- **Works offline**: if the devices are still on the same Wi-Fi or hotspot, transfers can keep working even without internet access.
- **Optional secure mode**: links and QR codes can carry an access `key`, and refreshing the address invalidates the old one immediately.

## Great Use Cases

- Send `APK`s, images, PDFs, zip files, logs, and test builds to a phone quickly
- Push text snippets, JSON, links, and configuration content to a real device during debugging
- Transfer files when you do not have a cable and do not want to use cloud drives or chat apps
- Share logs, samples, screenshots, or documents with multiple teammates so each person can download and analyze them locally
- Put phone-side files into the share list and download them later from a browser on your computer

## Get Started In 3 Steps

1. Install and open **FileFlash-Bridge** on your iPhone or Android phone.
2. Put your phone and computer on the same Wi-Fi or hotspot, then start the in-app transfer service and copy the link or scan the QR code.
3. Upload files, send text, or download shared phone files from the browser.

The browser portal supports drag-and-drop uploads. In browsers that support directory upload, relative folder paths can also be preserved.

## Core Features

| Feature | What you get |
|------|------|
| Send text from browser to phone | Quickly move one-time codes, code snippets, URLs, notes, and short content to your phone |
| Upload files from browser to phone | Supports regular files, direct small-file uploads, and automatic chunked upload for large files |
| Share phone files back to the browser | Add files to the share list on the phone and download them from a browser |
| Export and system sharing | Received content can be exported to system storage or shared to other apps |
| Secure mode | Links can carry a `key`, which is useful when you do not want other devices on the same network to open the portal casually |

## FAQ

### Does transfer traffic go through the cloud?

The core transfer flow depends on the phone running a local service and is primarily designed for direct browser access on the same Wi-Fi or hotspot. For fuller details, see the [Privacy Policy](./docs/privacy-policy-zh.md).

### Does the browser need a client app?

No. Open the address shown in the app and use it directly in a browser.

### Which platforms are supported?

Both **iOS** and **Android** are supported. On iOS, search for **文件闪传桥** in the App Store. On Android, install the `APK` from this repository's GitHub Releases.

### Can it still work offline?

Yes. As long as the devices are still on the same Wi-Fi or hotspot, LAN transfer can continue without requiring the public internet.

### Is it suitable for multiple people working on the same file set?

Yes. You can add files to the share list and let multiple teammates download them separately in their own browsers for review, analysis, or archiving.

### How can I verify the Android package?

GitHub Releases also provide `SHA256SUMS.txt`, which you can use to verify the downloaded artifacts.

## Development And Build

<details>
<summary>Show developer notes</summary>

### Requirements

- **Node.js**: **22.13.0** is recommended
- **Android**: JDK 17, Android SDK, Build Tools 36, and NDK 27
- **iOS**: Xcode, CocoaPods, and Bundler are required for local iOS builds
- **Windows**: the repo is already set up for `gradlew.bat` workflows in PowerShell

### Local Debug

Install dependencies first:

```bash
npm install
```

Using two terminals is recommended:

```bash
# Terminal 1
npm run start
```

```bash
# Terminal 2
npm run android
```

### Common Scripts

| Command | Description |
|------|------|
| `npm run start` | Starts the Metro bundler |
| `npm run android` | Builds and installs the Android debug app |
| `npm run ios` | Runs the iOS app in a macOS + Xcode environment |
| `npm run test:unit` | Runs Jest unit tests |
| `npm run typecheck` | Runs `tsc --noEmit` |
| `npm run lint` | Runs ESLint |
| `npm run android:apk` | Builds the Android release APK on Windows |
| `npm run icons:generate` | Regenerates Android and iOS app icons from the root `app.png` |

### Release And Supporting Docs

- [Chinese Android release guide](./docs/github-actions-android-release.md)
- [English Android release guide](./docs/github-actions-android-release.en.md)
- [Android wireless debugging guide](./docs/android-wireless-debugging.md)
- OpenSpec design and requirements: `openspec/changes/launch-fileflash-bridge-v1/`

</details>

If this tool solves your transfer problem, feel free to try it, open an Issue, or leave a Star.

## License

See [LICENSE](./LICENSE).
