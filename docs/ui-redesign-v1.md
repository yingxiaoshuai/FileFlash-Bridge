# UI Redesign V1 Implementation Notes

## Scope

This V1 redesign keeps the transfer workflow in the existing React Native shared layer. It focuses on hierarchy, stepwise presentation, project-local icons, restrained surfaces, and lightweight motion.

The home workspace keeps two visual phases:

- Service startup: the start-service action is the centered primary action before the local service is reachable.
- Content and sharing workspace: after the service is reachable, service controls collapse into a compact address strip and the content/sharing workspace becomes primary.

Import/share and project viewing remain in the same workspace. Received browser files, app-imported files, shared files, text messages, export, delete, and share toggle actions continue to be managed together.

## Dependency Policy

V1 does not add native UI dependencies.

- No `react-native-sf-symbols`
- No `@react-native-community/blur`
- No `react-native-reanimated`
- No native Material Icons configuration

The implementation reuses:

- React Native
- React Native Paper
- `react-native-svg`
- Project-local `AppIcons*.tsx`
- Shared `theme.ts`, `colors.ts`, and `tokens.ts`

## Rollback

The previous theme has been preserved in `src/app/theme.legacy.ts`.

`src/app/theme.ts` exports `USE_REDESIGNED_UI` for a lightweight rollback hook if a future build needs to switch theme sources behind a flag.

## Validation

Automated validation to run after UI changes:

- `npm run typecheck`
- `npm run test:unit -- --runInBand`

Manual validation still required before release:

- iOS real device or simulator: startup, reachable service, browser upload, text submit, export, and share toggles.
- Android real device or emulator: the same flow plus narrow screen layout.
- Harmony environment: icon fallback, surface rendering, animation fallback, and basic transfer flow.
- Visual pass on narrow phone widths, common portrait widths, landscape, and wider screens.

## Future Enhancements

Real SF Symbols, BlurView, or Reanimated can be proposed later as separate changes after package availability, Harmony compatibility, and bundle impact are verified.
