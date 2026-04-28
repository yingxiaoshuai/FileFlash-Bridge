# HarmonyOS Porting Notes

Last updated: 2026-04-28

## Current conclusion

This repository is not ready for a real HarmonyOS target yet.

The two biggest blockers are:

1. The app currently depends on `react-native@0.85.0`, while the latest verified `@react-native-oh/react-native-harmony` package line checked during this session is `0.82.23`.
2. The app depends on several native modules, including a local package, `@fileflash/react-native-static-server`, that currently only has `android/` and `ios/` implementations.

Because of that, creating a `harmony/` directory right now would look complete but still fail at runtime or native build time.

## What is already known

Verified Harmony template packages were found for:

- `react-native-fs`
- `react-native-safe-area-context`
- `react-native-share`
- `react-native-svg`

The following dependencies still need manual verification or replacement planning:

- `@react-native-clipboard/clipboard`
- `@react-native-community/netinfo`
- `@react-native-documents/picker`
- `react-native-qrcode-svg` depends on `react-native-svg`, so it is only safe after `react-native-svg` is wired up

The following dependency is a direct blocker:

- `@fileflash/react-native-static-server`

## Repo tooling

Run the built-in compatibility check:

```bash
npm run harmony:doctor
```

Machine-readable output:

```bash
node scripts/harmony-doctor.mjs --json
```

## Recommended migration path

### Path A: Practical path now

1. Create a dedicated Harmony branch.
2. Align the branch to the verified RNOH React Native line.
3. Replace the supported third-party packages with Harmony template variants.
4. Port or replace `@fileflash/react-native-static-server`.
5. Verify or replace clipboard, netinfo, and document picker integrations.
6. Generate the Harmony target only after the native dependency list is green.

### Path B: Wait for a newer RNOH base

If you want to keep `react-native@0.85.x`, wait until the official Harmony React Native runtime catches up to the same React Native line, then repeat the dependency audit.

## Why the custom static server matters

This app's core LAN transfer flow depends on a local native HTTP runtime. The local package lives in:

- `packages/fileflash-static-server/android`
- `packages/fileflash-static-server/ios`

There is no `harmony/` or `ohos/` implementation in that package today, so even if the app shell rendered on Harmony, the main transfer service would still be unavailable.

## Suggested next implementation milestone

The next real engineering step is not "add a Harmony folder". It is:

1. Decide whether to port against `react-native@0.82.x` or wait.
2. Design a Harmony replacement for `@fileflash/react-native-static-server`.
3. Audit the remaining native modules one by one.

Once those decisions are made, the Harmony target scaffolding becomes straightforward instead of fragile.
