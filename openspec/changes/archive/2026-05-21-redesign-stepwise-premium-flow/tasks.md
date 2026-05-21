## 1. Step Flow Model

- [x] 1.1 Define shared workspace phase identifiers for service startup and the unified content-sharing workspace without adding persisted step state
- [x] 1.2 Add phase metadata for service startup and content-sharing workspace, including localized titles, short labels, status summaries, and completion state
- [x] 1.3 Update onboarding/tour target mapping so the existing guide can point at the new step containers without triggering business actions

## 2. Home Workspace Restructure

- [x] 2.1 Refactor `HomeScreen` into service startup and unified content-sharing workspace containers, with the service phase shown in detail only while it is not reachable
- [x] 2.2 Move service startup, address, QR code, copy link, refresh address, security mode, and network diagnostics into the service step context
- [x] 2.3 Combine file import, media import, shared list, received files, project messages, project files, selection mode, batch download, export, and share-state actions inside the same content-sharing workspace
- [x] 2.4 Keep project history, project switch, rename/delete actions, text copy, file export, and share toggles reachable without moving users into a separate project-view step
- [x] 2.5 Preserve existing stable interactions and add or retain `testID` values for service controls, import actions, shared file selection, project actions, content-sharing actions, and onboarding targets

## 3. Icon-First Controls

- [x] 3.1 Audit all high-frequency workspace actions and replace verbose utility buttons with existing icon-first controls where the meaning remains clear
- [x] 3.2 Add any missing shared icons needed for import file, import media, add/remove share, select mode, clear selection, help, copy, refresh, and more actions using the existing icon system
- [x] 3.3 Ensure every icon button has an `accessibilityLabel`, sufficient touch target size, disabled/busy states, and stable test coverage
- [x] 3.4 Keep explicit text and confirmation flows for primary commit and destructive actions such as start/stop service, delete, and batch export/save

## 4. Premium Visual System

- [x] 4.1 Update shared style tokens and workspace styles to support the step layout with restrained surfaces, consistent spacing, clear focus state, and non-overlapping responsive constraints
- [x] 4.2 Align Home, Settings, bottom Tab, notice banners, menus, drawer, and onboarding overlay with the same refreshed visual hierarchy
- [x] 4.3 Remove remaining dense panel stacking, redundant large buttons, decorative noise, and text-heavy explanatory blocks from the first-screen workflow
- [x] 4.4 Verify common phone widths keep step titles, QR code, address text, icon buttons, lists, and bottom navigation from overlapping or overflowing

## 5. Functional Regression

- [x] 5.1 Add or update component tests for phase derivation before service start and after service is reachable, including content-sharing workspace rendering when project/shared content exists
- [x] 5.2 Add or update tests proving existing operations remain reachable in the unified content-sharing workspace: service toggle, copy/refresh address, import files/media, batch download, project switch, rename/delete, message copy, file export, and share toggle
- [x] 5.3 Add or update tests for icon-first controls, including accessibility labels and stable test IDs
- [x] 5.4 Run TypeScript typecheck and the full Jest unit suite

## 6. iOS and Android Validation

- [ ] 6.1 Validate the stepwise workspace on iOS simulator or device across service stopped, service running, content-sharing workspace, shared files present, project content present, and error states
- [ ] 6.2 Validate the stepwise workspace on Android emulator or device across the same service, content-sharing, project, and error states
- [ ] 6.3 Perform real-device LAN content delivery validation: browser uploads a file, browser submits text, App shows the results in the unified content-sharing workspace, received files can be added to sharing there, and App export/save still uses explicit user action
- [ ] 6.4 Validate permission and system interaction flows on both platforms, including file picker/import, media import, export/save/share sheet, local network availability, and Android hardware back behavior with drawers or onboarding
- [ ] 6.5 Capture final visual checks for iOS and Android common screen widths to confirm the interface feels polished, icon-led, and not overcrowded
