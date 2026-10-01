# Unsloth fork delta and semantic traces

Comparison: recorded local `upstream/main` merge base to `78a2485b7`. See [00-baseline.md](00-baseline.md). Saved evidence: [commits](evidence/fork-commits.txt), [file statuses](evidence/fork-files.txt), [statistics](evidence/fork-stat.txt).

Entire fork delta: 258 files, 12,344 insertions, 37,493 deletions. Studio: 193 files, 11,796 insertions, 806 deletions. Much of the full-tree deletion count is removed GitHub Actions workflow configuration, not removed application behavior. The working `.github/workflows` inventory contains zero files. Do not restore CI as incidental migration cleanup.

## Semantic groups

| Group | Source evidence | Meaning / disposition |
|---|---|---|
| VoiceForge identity/catalog/RVC | `core/inference/{providers,external_provider}.py`, `routes/providers.py`, `models/inference.py`; frontend `voiceforge.ts`, `voiceforge-selectors.tsx`, provider dialog and voice store | KEEP + targeted ownership work. VoiceForge root URL normalization, `/audio/options`, speech/recognition selection, per-request RVC overrides are real fork additions. |
| Incremental speech | frontend `live-speech.tsx`, `streaming-speech.ts`, speech adapter, runtime provider and thread | KEEP. Sentence/phrase chunking, ordered playback, prefetch, cancellation, code-block exclusion. |
| Recipe capabilities | `core/data_recipe/{identity,jsonl_export,sparse_repair_steps,builtin_tools_mcp}.py`; Recipe Studio blocks/dialogs/import/payload/validation | KEEP, outside companion migration. Hash identity, repair/export tooling and agentic recipe tools are intentional fork work. |
| Recipe lifecycle/storage | job checkpoints/deletion/manager/worker, `routes/data_recipe/saved.py`, frontend execution reconciliation | KEEP. Checkpoint validation, restart/resume reconciliation, account-scoped saved recipes and browser migration must survive. Not end-to-end validated here. |
| Training observability/controls | `core/training/training_entries.py`, trainer/worker, training routes/models, transcript/chart/config UI | KEEP. Entry inspection, logging interval and reasoning-related controls are unrelated to companion delivery but must not regress. |
| External sampling/tool settings | `external-sampling.ts`, provider client, chat adapter/runtime, inference route | KEEP. Optional sampling fields are omitted when unset instead of forcibly forwarded. |
| Appearance/personalization | theme boot/store, palettes, custom controls, CSS, personalization API/settings | KEEP as existing Studio configuration. Dedicated companion composition can extend existing UI primitives. |
| Account/security changes | `auth/storage.py`, saved recipe routes and tests; recent merge commits | Preserve account boundaries. Do not generalize the local single-workstation target into one unscoped shared store. |
| Experiments/history | commits with `test`, `sync`, reverted TTS experiments | Intent cannot be inferred from titles. Current call paths and regression evidence outrank historical labels. No deletion classification based on these titles. |

## Existing speech call paths

All Unsloth paths below are relative to `studio/`.

### Connection and discovery

`frontend/.../settings/tabs/voice-tab.tsx` calls `voiceForgeSettings(connectionId)` to select one connection for ASR and TTS. Connection metadata comes through `useExternalProvidersStore`; backend provider configuration/credentials use the existing provider storage and resolution path.

`VoiceForgeSelectors` -> authenticated `GET /api/providers/{id}/voiceforge-options` -> `routes/providers.py:voiceforge_options` -> `ExternalProviderClient.voiceforge_options` -> VoiceForge `/v1/audio/options`.

VoiceForge `app/servers/main_server.py:audio_options` exposes speech models, recognition models, prompt-library voice choices and RVC model names. The frontend renders both recognition and synthesis instances of `VoiceForgeSelectors`, each with its own fetch state. This duplicates catalog requests/cache state, not two backend credential authorities.

Voice settings use `unsloth_voice_settings` in browser localStorage. Server provider configuration is a different responsibility. Cross-device/account behavior of voice preferences is not proven; do not claim server-owned persona/speech profiles already exist.

### Recognition

`studio-dictation-adapter.tsx` selects a dictation adapter. `studio-model-dictation-adapter.ts` owns microphone recording/segments, levels, selected language, transcript correction/history, stop and abort behavior. It has Whisper-oriented 20–28-second segmentation with silence cuts; this is dictation behavior, not a low-latency conversational turn detector.

Custom connection -> `transcribeAudioBlob` -> `POST /api/inference/audio/transcriptions` with provider ID, model, recording and optional language -> existing backend external-provider transcription handling -> VoiceForge `/v1/audio/transcriptions` -> `routers/asr.py` -> `audio_contract.proxy_transcription` -> configured ASR worker.

`proxy_transcription` bounds uploads, retains upstream status/content, watches disconnect and cancels the outbound HTTP task. Whether the ultimate native ASR inference stops promptly requires a live test. No transcription prompt/timestamp fallback is introduced.

The dictation adapter has no diff against the recorded upstream ref. This does NOT make it irrelevant: fork-added VoiceForge provider identity/configuration uses this inherited runtime path.

### Read-aloud and incremental TTS

`runtime-provider.tsx` mounts `LiveSpeech`. It reads visible assistant text, omits fenced code, responds to thread/run changes and uses `StreamingSpeechQueue(new StudioSpeechSynthesisAdapter())`. The queue assembles sentence/phrase chunks, bounds long text, preserves order and prepares one next utterance during playback. It cancels if already-spoken source text is rewritten.

Manual read-aloud and live speech share `StudioSpeechSynthesisAdapter`. `generateCustomTtsAudio` snapshots connection state, checks connection changes after encryption and before authenticated retry, then posts to `/api/inference/audio/speech`.

Backend `routes/inference.py` delegates to `ExternalProviderClient.create_speech`, which normalizes VoiceForge `/v1` and translates RVC selection. Omitted RVC uses provider settings; empty disables it; a model name enables that model. Backend disconnect observation cancels the upstream HTTP task.

VoiceForge `routers/tts.py:create_speech` uses its existing generation pipeline and watches disconnect. Current native model stages may finish before cancellation settles; request cancellation is not GPU-kernel preemption.

Audio is received with `response.arrayBuffer()`, wrapped in a blob URL, played by `Audio`, then released. Read-aloud splits long VoiceForge inputs at 1,200 characters. Live speech's smaller chunks and this service-size limit serve different purposes; they are not automatically duplicate queues.

### Cancellation/ownership findings

- Queue cancellation drops queued text, cancels prepared/current utterances and ignores subsequent updates.
- Adapter cancellation aborts HTTP, pauses/removes audio source, releases object URLs and resolves pending playback completion.
- Live speech stops ordinary read-aloud when starting, and responds to thread/provider/enable changes. Reverse exclusion, preview-vs-chat conflicts, and eventual call-vs-read-aloud arbitration need characterization.
- Live speech uses message IDs and local queue state; there is no demonstrated server-owned utterance/playback acknowledgement or generated-versus-spoken transcript.
- This is a sound substrate for calls, but not proof of barge-in, full duplex, WebRTC, or a session-wide hard stop.

## Existing backend ownership outside the delta

`core/inference/__init__.py` exposes `InferenceOrchestrator` and `LlamaCppBackend`; model lifecycle already has process supervision/cancellation. `main.py` mounts native and OpenAI-compatible routes. `storage/studio_db.py` owns chat persistence; generation runs add their event/lease store.

`chat_generation_runs.py` is an existing durable producer/supervisor, not a missing feature because the design says Run Coordinator. Its route explicitly excludes external-provider and inline media requests. Tool-enabled local text turns are enabled by default.

`studio_tool_loop.py` already shares external-provider tool orchestration across transports. GGUF and safetensors loops use shared `ToolLoopController`, `execute_tool` and streaming execution helpers. Whether remaining orchestration is materially duplicated requires focused tests; do not replace these with a fresh universal loop on naming grounds.
