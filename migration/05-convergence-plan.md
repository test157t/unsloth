Current status (September 24): [implementation checkpoint](11-companion-implementation.md). Training has finished; the audit and deferred-work statements below record the earlier baseline.

# Proposed in-place convergence plan

Accepted scope: a dedicated companion area within Studio, retaining all existing Studio areas. Implementation is incremental; no production migration occurred in this audit.

## Slice 0 — Make the regression baseline trustworthy

Status: the test fixture repair is complete, and the seven-file frontend selection passes 61/61. Live validation is deferred while the owner's training run is active. Keep follow-up work offline and lightweight; do not rebuild served frontend assets or start inference/speech/model work during training.

- Repair only the stale `tts-custom-connections-disabled.test.ts` module loader setup: it does not provide the `../voiceforge` import now used by the real speech adapter. Prefer wiring the real dependency through the existing loader or an explicit real-module binding; do not bypass connection-policy assertions.
- Re-run the seven selected frontend files (61 tests before repair: 52 pass, 9 harness failures). Add focused characterization only where live/manual arbitration lacks coverage.
- Use installed Studio Python for backend tests; do not reinstall or repair a working environment because sandbox execution failed.
- Verify current launcher and browser login/chat/reload/cancel, then actual VoiceForge ASR/read-aloud/incremental output. Record selected models/hardware and cancellation/first-audio latency. Reuse current private URLs; no process/port overhaul.
- Exit: test harness passes and runtime gaps are measured or explicitly isolated. Production behavior unchanged.

## Slice 1 — Dedicated companion area using the existing conversation runtime

- Add the companion route/navigation/composition under the existing frontend features/router. Exact route name is an implementation choice, not a separate app.
- Reuse existing authentication, thread persistence, model/provider selection, streaming runtime and voice settings. Establish a companion profile using existing prompt/settings storage after tracing prompt precedence.
- Keep training, recipes, general chat and their routes intact.
- Identify existing account/thread/run IDs as the sole conversation identity. Do not duplicate the very large chat runtime to customize its visual shell; extract a narrow reusable composition boundary if needed.
- Exit: companion conversation survives reload and can be opened through existing history; provider changes and cancellation use existing owners; ordinary Studio flows still work.

## Slice 2 — Session lifecycle and typed MediaStage

- Add only the new session state needed to reference an existing account/thread/run and permitted presentation capabilities. Follow Studio migration/storage conventions rather than copying the design's illustrative SQL wholesale.
- Add validated spiral/image/video/clear actions through existing tool registration/policy and a companion renderer. Port ErisHub semantics/presets selectively, with provenance if code is copied.
- Implement Stop Session as immediate local media/audio stop plus idempotent server stop. Invalidate stale session commands/results, cancel owned runs/tools through existing cancellation, and persist terminal state.
- Keep Stop Session outside model-controlled layers. Session controls remain available if inference, speech or transport fails.
- Companion tool availability must not allow arbitrary generated code to substitute for typed immersive presentation. General Studio artifacts remain available in their existing area.
- Exit: repeated stop, disconnect, late media/tool events, thread switch and permission changes cannot restart stopped presentation. Ordinary chat history remains usable.

## Slice 3 — Tighten shared speech ownership

- Share VoiceForge catalog discovery data, preserving existing provider client and explicit refresh.
- Characterize and consolidate manual/live/preview playback arbitration around the current synthesis adapter. Define session/run/utterance IDs, stale-result rules and disposal.
- Preserve Unicode segmentation, service-size limits, one-ahead prefetch, speed/volume, RVC and voice selection, dictation dictionary/history and connection disable checks.
- Define which speech preferences are account/profile data and which remain device-local. Do not overwrite existing saved choices.
- Exit: one playback owner; switching thread/provider/settings, stopping and late synthesis completion do not leak audio; ordinary dictation/read-aloud still pass.

## Slice 4 — Calls on the existing conversation/speech core

- Add VAD/turn coordination and barge-in. Existing dictation segmentation does not by itself satisfy conversational turn timing.
- Preserve actually spoken text versus generated-but-unspoken text with playback acknowledgements. Keep microphone ownership and transcripts attached to the same session/conversation.
- Use ErisHub/Video-chat only as behavior references. No independent `messages` list, direct llama bridge or second speech queue.
- Design the future WebRTC provider boundary here; implement transport only after lifecycle/ownership is proven. Do not transport new call microphone/camera media over a generic application WebSocket.
- Exit: interruption, speech failure, reconnect and end-call behavior meet measured budgets with no history split.

## Slice 5 — Video and optional integrations

Frame sampling, vision observations, camera indicators and WebRTC deployment extend the same session. VRM/avatar, memory evolution, organizer/Discord/SIP/Intiface are deferred until deliberately selected; none is an implied dependency of the initial companion.

## Per-slice regression rule

Use existing tests plus targeted behavior checks for moved ownership. Include cancellation, account isolation, saved config, route compatibility and source import boundaries. Record provenance and a replacement test before deletion. Do not reformat or update dependencies across unrelated training/recipes code.

## Decisions still requiring product input before their affected slice

- Which optional ErisHub integrations should survive beyond core companion/session/media?
- Should interrupted calls retain generated-but-unspoken text visibly, or only as internal metadata?
- Which voice/persona settings should follow the account across devices versus stay device-local?

These do not block baseline work. Dedicated companion area and in-place repository location are already settled.

## Code workspace integration (September 24)

[Code tab scope and verification](12-code-editor-integration.md) adds an in-place `/code` workspace alongside Companion. File editing and Git controls reuse Studio workspace identity and existing chat composition. This is an additional product slice; it does not complete companion profiles, server sessions, typed MediaStage or calls.
