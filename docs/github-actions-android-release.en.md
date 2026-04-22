# Android GitHub Release Automation

中文版: [github-actions-android-release.md](./github-actions-android-release.md)

This repository already includes an Android release workflow:

- Workflow file: [`/.github/workflows/android-release.yml`](../.github/workflows/android-release.yml)
- Trigger: push a tag such as `v0.0.1`
- Release artifacts: signed 32-bit `APK`, signed 64-bit `APK`, `AAB`, and `SHA256SUMS.txt`
- Publish target: GitHub Release

## Release Flow

After you run commands like these:

```powershell
git tag v0.0.1
git push origin v0.0.1
```

GitHub Actions will automatically:

1. Check out the repository.
2. Install Node.js, Java, Android SDK, Build Tools, and NDK.
3. Run `npm ci`.
4. Derive the Android version from the tag.
5. Rebuild the signing keystore from GitHub Secrets.
6. Build signed 32-bit and 64-bit release `APK` outputs, plus the release `AAB`.
7. Generate `SHA256SUMS.txt`.
8. Create or update the matching GitHub Release and upload the artifacts.

## Tag Rules

The workflow listens to `v*` tags, but it also validates the version format before building.

The tag must use a three-part numeric version:

- `v0.0.1`
- `v0.1.0`
- `v1.2.3`

Anything outside that format will fail the workflow.

## Version Mapping

The workflow derives:

- `versionName = tag without the leading v`
- `versionCode = major * 1000000 + minor * 1000 + patch`

Examples:

- `v0.0.1` -> `versionName = 0.0.1`, `versionCode = 1`
- `v1.2.3` -> `versionName = 1.2.3`, `versionCode = 1002003`

## Required GitHub Secrets

Go to:

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Create these 4 repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## Convert the keystore to Base64

Your local keystore path is:

`E:\key\fileFlash.jks`

Run this in PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('E:\key\fileFlash.jks')) | Set-Clipboard
```

That copies the full Base64 string into your clipboard. Paste it into the `ANDROID_KEYSTORE_BASE64` secret.

If you prefer writing it to a file first:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('E:\key\fileFlash.jks')) | Out-File -Encoding ascii .\fileFlash.jks.base64
```

## How the keystore is rebuilt in GitHub Actions

The workflow reconstructs the keystore on the runner with:

```bash
printf '%s' "${ANDROID_KEYSTORE_BASE64}" | base64 --decode > "${RUNNER_TEMP}/fileflash-release.jks"
```

This means:

- the `.jks` file does not need to be committed
- the keystore exists only during the CI run
- the runner is discarded after the build

## Current Build Environment

The workflow currently uses:

- Node.js `22.13.0`
- Java `17`
- Android Platform `android-36`
- Build Tools `36.0.0`
- NDK `27.1.12297006`

## Uploaded Release Artifacts

The workflow uploads these files to GitHub Release:

- `android/app/build/outputs/apk/release/app-armeabi-v7a-release.apk`
- `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/SHA256SUMS.txt`

## Common Failure Points

### 1. Invalid tag format

If the tag is not in `vX.Y.Z` format, the version parsing step will fail.

### 2. Missing secrets

If any keystore or password secret is missing, the signed Android build will fail.

### 3. Broken Base64 content

If `ANDROID_KEYSTORE_BASE64` is incomplete or truncated, the decoded keystore will be invalid and signing will fail.

## Recommended Release Checklist

Before creating a release tag, it is worth confirming:

- the intended version is consistent with your release plan
- Android builds successfully at least once locally
- all 4 GitHub Secrets are configured correctly
- the tag uses the final release version, for example `v0.0.1`
