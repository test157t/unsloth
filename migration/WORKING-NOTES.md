# Handoff notes

Upstream synchronization is recorded in [14-upstream-sync-2026-10-01.md](14-upstream-sync-2026-10-01.md).
Main now includes upstream `1d4727cf2`, published as merge `3215fbbee`. Companion/editor
work remains local and uncommitted, with its original stash backup retained. The
combined frontend build and focused backend/frontend regression checks pass.

## October 1 checkpoint

Current status: [13-faithful-feature-integration.md](13-faithful-feature-integration.md).
Selected Mia.vrm rendering was repaired: pane containment/resizing, serialized runtime
loads/teardown and consistent profile selection. The production frontend was rebuilt;
three focused tests and an isolated browser check pass. Main Studio was left stopped.
Earlier reduced implementations were not accepted as fulfilling the ErisHub scope.
Hypnosis session orchestration and full authenticated integration checks remain open.
The older running-process and completion statements below are historical.

Current status: [11-companion-implementation.md](11-companion-implementation.md). Earlier numbered audit files are historical evidence, not current implementation status.

Settled: in-place Unsloth; dedicated Companion area; retain training/recipes/general chat; reuse VoiceForge and existing backend owners. The owner explicitly confirmed training finished on September 24.

Companion route, navigation/composition and browser speech mutual exclusion are implemented. Focused tests: 116 passed. Build passes. Studio is running on port 8888 through its installed launcher; browser verification awaits owner login in the opened tab.

Next: authenticated desktop/mobile verification, then trace prompt/profile storage and implement the server session lifecycle/typed MediaStage using existing conversation/run owners. The local focus light and speech stop are not the full MediaStage or cross-layer Stop Session.

Preserve existing saved configuration. No inference/model load has been run for this checkpoint. No commit/push has been requested.

## Code tab follow-up (September 24)

Current additional scope: [12-code-editor-integration.md](12-code-editor-integration.md). `/code` integrates text editing, Git review/stage/commit and the same persistent chat. Tests/build and launcher verified; authenticated browser checks remain pending sign-in. No source repo was committed or pushed. The failed startup caused by the initial missing request-model import was corrected, and a route-registration regression test was added. Do not mistake the old browser connection-error tab for the current server state.
