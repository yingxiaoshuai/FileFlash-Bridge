# HarmonyOS Porting Notes

Last updated: 2026-04-29

## Current conclusion

This repository now includes a checked-in `harmony/` scaffold and is aligned to the verified RNOH React Native line, but it is not ready for a full end-to-end HarmonyOS build yet.

The two biggest blockers are:

1. The app still needs its supported third-party native modules swapped to their Harmony template variants before the Harmony target can be linked and built reliably.
2. The app still relies on app-owned native bridges for direct system share intake, such as `FPInboundSharing`, and those bridges do not have a Harmony implementation yet.

The host project exists so the team can start wiring the platform, but native/runtime gaps still prevent a fully working Harmony build today.

## What is already known

Verified Harmony template packages were found for:

- `@react-native-clipboard/clipboard`
- `@react-native-community/netinfo`
- `@react-native-documents/picker`
- `react-native-fs`
- `react-native-safe-area-context`
- `react-native-share`
- `react-native-svg`
- `react-native-tcp-socket`

Additional notes:

- `react-native-qrcode-svg` depends on `react-native-svg`, so it is only safe after `react-native-svg` is wired up.
- The repo now includes a Harmony JS HTTP runtime built on top of `react-native-tcp-socket`, so Harmony no longer needs to port `@fileflash/react-native-static-server` directly.
- Direct inbound share-sheet support still needs a Harmony-native bridge for `FPInboundSharing`.

## Repo tooling

Run the built-in compatibility check:

```bash
npm run harmony:doctor
```

Machine-readable output:

```bash
node scripts/harmony-doctor.mjs --json
```

Current scaffold-related commands:

```bash
npm run harmony:clean
npm run harmony:codegen
npm run harmony:link
npm run harmony:bundle
npm run harmony:run
```

## Recommended migration path

### Path A: Practical path now

1. Create a dedicated Harmony branch.
2. Align the branch to the verified RNOH React Native line.
3. Replace the supported third-party packages with Harmony template variants.
4. Use the TCP socket Harmony runtime path instead of porting `@fileflash/react-native-static-server`.
5. Port the app-owned inbound share bridge (`FPInboundSharing`) if you want true system share-in support on Harmony.
6. Generate the Harmony target only after the native dependency list is green.

### Path B: Wait for a newer RNOH base

If you want to move forward on the current path, keep the workspace on `react-native@0.82.1` with `@react-native-oh/react-native-harmony@0.82.23`, then continue replacing native dependencies and bridging app-owned modules.

## Why the TCP runtime matters

This app's core LAN transfer flow depends on a local HTTP runtime. The legacy native package still lives in:

- `packages/fileflash-static-server/android`
- `packages/fileflash-static-server/ios`

There is still no `harmony/` or `ohos/` implementation in that package today, but the repo now also contains:

- `src/modules/service/reactNativeTcpHttpRuntime.ts`

That runtime uses `react-native-tcp-socket` and is intended to be the Harmony path for the local transfer service, so the static server package no longer needs to be ported 1:1 for Harmony.

## Remaining native gap

The main feature gap that still needs Harmony-native work is direct system share intake:

- iOS and Android currently use `FPInboundSharing`
- Harmony still needs an equivalent bridge if you want files/text to be received from other apps through the OS share sheet

## Suggested next implementation milestone

The scaffold is now in place. The next real engineering steps are:

1. Replace the supported native dependencies with their Harmony template packages.
2. Wire the Harmony branch to the TCP socket runtime and matching template package set.
3. Port the inbound share bridge for Harmony.

Once those decisions are made, the Harmony target scaffolding becomes straightforward instead of fragile.
