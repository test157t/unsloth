# Companion implementation checkpoint — 2026-09-24

The owner confirmed training has finished. The previous active-training restriction is lifted. This is the current status; earlier audit files describe the September 23 baseline.

## Implemented

- Authenticated `/companion` route and Companion sidebar entry, within the existing Studio shell and chat-only mode allowlist.
- One persistently mounted ChatPage serves general chat and Companion. Existing account, conversation, inference, tools, provider selection, streaming, persistence and voice settings remain authoritative.
- Companion side panel provides voice/conversation settings, a reduced-motion-aware local focus light, immediate speech stop, and return to general chat. The existing New Chat actions remain the single new-conversation path.
- Chat/history navigation, global new-chat shortcuts, and archive/delete handling recognize Companion and preserve the selected workspace. Entering Companion from chat preserves search parameters, including comparison state.
- A browser-level speech owner arbitrates manual read-aloud, live speech queues and settings preview. A new owner cancels the old one, including queued/prefetched synthesis. Late completion cannot release a successor's ownership. Closing Companion stops speech and discards its local focus state.

The stop control is explicitly **Stop speech and clear focus**. It is not the future cross-layer Stop Session: it does not cancel inference or tools. The focus light is local presentation, not a model-controlled MediaStage.

## Verification

- 116 focused frontend tests passed, including real speech adapter/queue behavior with mocked HTTP/audio, route classification, connection disable policy, voice selection, microphone/device controls and settings/history tests. See `evidence/companion-tests.log`.
- Production TypeScript/Vite build passed; see `evidence/companion-build.log`.
- Existing installed Studio launcher started successfully on port 8888; health returned HTTP 200. No dependency update, reinstall, model load or inference request was made.
- Browser reached the real Studio login screen. Authenticated visual/navigation verification is pending owner sign-in; no browser-layout or actual speech-quality claim is made yet.

## Remaining design work

This implements the route/composition part of slice 1 and basic playback mutual exclusion from slice 3. It is not the complete v0.03 product.

1. Verify authenticated desktop/mobile rendering, conversation reload/history, shortcuts and speech interactions in the browser.
2. Trace existing prompt precedence before introducing persisted companion persona/profile state.
3. Implement server-owned session lifecycle referencing existing conversation/run IDs, typed MediaStage actions and idempotent cross-layer Stop Session.
4. Add call turn coordination, playback acknowledgements and interruption semantics through existing runtime owners.
5. Measure real VoiceForge latency and cancellation; evaluate optional integrations only after the core lifecycle works.

No second backend, conversation store, inference supervisor or speech engine was added. Existing training and Recipe Studio implementations are retained.

Additional delivered Studio area: [Code editor integration](12-code-editor-integration.md). The root now shares the same conversation runtime across Chat, Companion and Code.
