## Harmony Platform

This `harmony/` directory was scaffolded from the official RNOH `init-harmony` template and then adapted for `FileFlash Bridge`.

Current assumptions:

- Bundle name: `com.fileflashbridge.harmony`
- JS app key: `FileFlashBridge`
- Local React Native / RNOH line: `react-native@0.82.1` + `@react-native-oh/react-native-harmony@0.82.23`
- Local Harmony CLI: `@react-native-oh/react-native-harmony-cli@0.82.23`

Current status:

1. Supported third-party native modules have been swapped to Harmony template packages in this workspace.
2. The app-owned inbound sharing flow is now handled through the Harmony host ability and a shared inbox manifest consumed by the React Native layer.

Remaining work is mainly device-side validation in DevEco Studio, especially around:

1. Verifying OS share-sheet delivery for single-file, multi-file, and text payloads.
2. Validating UI behavior for JavaScript-only packages such as `react-native-paper` on Harmony devices.

Helpful commands:

- `npm run harmony:doctor`
- `npm run harmony:link`
- `npm run harmony:codegen`
- `npm run harmony:bundle`
- `npm run harmony:run`

Command notes:

- The Harmony CLI commands are exposed through `react-native`, not through `rnoh-cli`.
- `npm run harmony:bundle` generates the fallback rawfile bundle used by `entry/src/main/ets/pages/Index.ets` (`bundle.harmony.js`).

For local signing, copy `build-profile.template.json5` to `build-profile.json5` and complete the signing config in DevEco Studio.
