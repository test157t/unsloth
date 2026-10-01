Current status (September 24): [implementation checkpoint](11-companion-implementation.md). Training has finished; the audit and deferred-work statements below record the earlier baseline.

# Speech playback entry points

Read-only source follow-up during the owner's active training run. These findings describe call paths; browser concurrency behavior has not been exercised.

## Current ownership

| Entry point | Synthesis | Playback/state | Stop path |
|---|---|---|---|
| Manual read-aloud | `StudioSpeechSynthesisAdapter.speak` | assistant-ui speech state; adapter owns audio element/request | `ActionBarPrimitive.StopSpeaking` / `thread.stopSpeaking()` |
| Speak while generating | Same adapter via `StreamingSpeechQueue` | `LiveSpeech` owns queue; `useLiveSpeechStore` exposes current message/stop | queue cancels current and prefetched utterances |
| Settings voice preview | Calls `generateCustomTtsAudio` or `generateStudioTtsAudio` directly; system mode uses configured utterance | `voice-tab.tsx` owns separate Audio/ref/controller, preview state | `stopPreview`, abort/ref cleanup, unmount effect |

The preview reuses synthesis helpers but bypasses the speech adapter's playback ownership. This is a concrete third playback entry point, not a second VoiceForge client.

## Existing protections found

- `live-speech.tsx` stops existing assistant-ui manual speech when a live queue starts.
- Thread/provider/enable changes clean up the live queue.
- `thread.tsx:AssistantActionBar` recognizes the live message ID, shows a live Stop reading control and hides manual Speak for that same message.
- Manual speech state and the live message state both keep the message's action bar visible during generation.
- Message deletion stops assistant-ui speech if its spoken message is among the removed messages.
- Preview guards double-clicks with a ref, cancels pending HTTP, disposes audio URLs and stops on settings-tab unmount.

## Remaining characterization cases

1. Manual read-aloud on an older message while a different message is speaking through the live queue. The inspected manual Speak wrapper does not explicitly stop `useLiveSpeechStore`; runtime behavior must be tested rather than assumed.
2. Settings custom/model preview while manual/live chat audio is active. The inspected preview start path has its own audio element and no explicit shared arbiter call.
3. Delete/edit the live-speaking message. The deletion handler checks assistant-ui speech state; the live queue relies on React message/effect updates. Verify disposal and late results across both paths.
4. Stop during prepared synthesis, then switch thread/provider and receive a delayed completion. Existing queue tests cover its own cancellation, not all UI entry-point transitions.
5. System voice preview calls browser-wide `speechSynthesis.cancel()`, whereas custom audio playback uses independent Audio elements. Avoid treating those cancellation scopes as identical.

## Proposed consolidation boundary

2026-09-24 follow-up: seven executable adapter/queue tests now cover prepared playback, cancellation before/after response, late events, prefetch disposal, ordered completion and synthesis failure. The real adapter and queue are used with fake HTTP/audio; all seven pass. The combined speech selection is 68/68. Cases 1–3 above still need mounted UI characterization; case 4 now has adapter/queue coverage but not a React thread/provider-switch test. No playback authority has been changed.

One playback owner should arbitrate manual, live, preview and future call output, while retaining existing synthesis helpers, VoiceForge provider configuration, segment size limits and recording/transcription adapters. It should expose owner identity and stop/dispose behavior; session/run/utterance ownership should prevent stale output from regaining playback.

Do not implement this by adding a fourth independent queue. Do not remove service-limit segmentation merely because live speech also chunks text. Establish the cases above with controlled fake audio/fetch and later real-browser verification before changing production playback.

## Companion integration pointers

- Route composition: `studio/frontend/src/app/router.tsx` (not a filesystem `src/routes` tree).
- Navigation: `studio/frontend/src/components/app-sidebar.tsx` and existing sidebar organization utilities.
- Conversation/streaming integration: `features/chat/runtime-provider.tsx`, `features/chat/api/chat-adapter.ts`.
- Schema authority: `studio/backend/storage/studio_db.py` already creates chat thread/message/run/event tables and performs guarded migrations. Extend existing account storage conventions; do not create a second conversation database.

No production route, navigation, schema or playback changes were made during this follow-up.
