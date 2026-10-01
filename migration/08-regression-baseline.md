Current status (September 24): [implementation checkpoint](11-companion-implementation.md). Training has finished; the audit and deferred-work statements below record the earlier baseline.

# Regression baseline

Baseline revision: `78a2485b7a8b7784abdfb03da5bd072cff8c4385`.

## Executed checks

### Frontend build — PASS

Working directory: `D:/Github/unsloth/studio/frontend`.

```powershell
npm.cmd run build
```

Runs `tsc -b && vite build`. Exit 0; 8,425 modules transformed. Warnings: CSS `::highlight` optimizer recognition, chunks exceeding 500 kB. These are baseline warnings; no bundling changes made.

### Focused frontend speech — PASS

```powershell
node --experimental-strip-types --test tests/voiceforge.test.ts tests/streaming-speech.test.ts tests/dictation-outcome.test.ts tests/dictation-send.test.ts
```

34/34 passed (initial verification, reconfirmed within the expanded selection). Covers sentence/Unicode boundaries, request limits, RVC options, shared connection selection, queue order/prefetch/cancel, transcript failure/outcome state and dictation send/thread-switch behavior. These are unit/source-contract tests, not a microphone/audio-device integration run.

### Expanded frontend speech — BASELINE FAILURE

```powershell
node --experimental-strip-types --test tests/voiceforge.test.ts tests/streaming-speech.test.ts tests/dictation-outcome.test.ts tests/dictation-send.test.ts tests/tts-custom-connections-disabled.test.ts tests/read-aloud-tts-model-row.test.ts tests/chat-speech-model-not-adopted.test.ts
```

61 total: **52 passed, 9 failed**. Follow-up running only the final three files: 27 total, 18 passed, same 9 failed. [Failure log](evidence/frontend-speech-extended.log).

Every failure originates in `tests/tts-custom-connections-disabled.test.ts` and says `no stub for import "../voiceforge"` in the real speech adapter. Its `loadWithStubs` map omits the fork-added import; the helper defaults to rejecting unstubbed imports. Tests fail during module load, before their connection-disable, key-forwarding and retry assertions. This is a confirmed harness integration gap, not demonstrated production failure. Do not delete/weaken the assertions. Repair the fixture in slice 0.

### Slice 0 follow-up — frontend fixture repaired, 61/61 PASS

The fixture now imports the real `voiceforge.ts` module and binds it explicitly as `../voiceforge` in the loader. The loader remains strict for every other import. No production implementation or assertions changed.

Re-ran the same seven-file selection with `--test-concurrency=1 --test-reporter=spec`: **61 passed, 0 failed, 0 skipped**, approximately 1.75 seconds. [Repaired test log](evidence/frontend-speech-repaired.log). The nine connection-policy checks now execute their assertions successfully.

The owner reported active training before this follow-up. Only the test file and migration notes were edited. No build, backend test, live service call, model load, launcher operation or configuration change was performed during the follow-up. The build/backend results below and above are from the earlier audit, before that constraint was reported.

### Focused backend — PASS WITH ONE SKIP

Working directory: `D:/Github/unsloth/studio/backend`.

```powershell
& 'C:\Users\xmgha\.unsloth\studio\unsloth_studio\Scripts\python.exe' -m pytest -q tests/test_voiceforge_options.py tests/test_openai_audio_speech_route.py tests/test_openai_audio_transcriptions_route.py tests/test_mcp_http_sessions.py tests/test_mcp_stdio_sessions.py tests/test_llama_cpp_stream_cancel.py
```

**211 passed, 1 skipped, 15 warnings in 92.69s.** Tests cover mocked provider catalog/RVC, speech/transcription routes, MCP session lifecycle and llama streaming cancellation. One skipped test's reason was not printed by `-q`; the suite is not represented as entirely executed. Warnings include 14 PyTorch deprecations and an unwritable pytest cache directory. Test assertions completed successfully.

Runtime troubleshooting: restricted execution initially could not start either venv's base interpreter. Direct execution reported access denied, and both base executables existed. Approved unsandboxed execution worked. Repo `.venv` lacks pytest; installed Studio venv contains it. No installation changes were needed or made.

## Required live characterization before ownership changes

### 2026-09-24: adapter/queue lifecycle characterization — PASS

Added `studio/frontend/tests/speech-playback-lifecycle.test.ts`. It runs the real synthesis adapter, real VoiceForge segmentation helpers and real `StreamingSpeechQueue` with controlled HTTP completion and fake Audio elements. Native fetch is replaced with a throwing guard. No browser, application service, real credentials or GPU is used.

Seven new cases prove:

- prepared audio waits for playback handoff;
- cancellation before late synthesis completion disposes the URL and prevents playback;
- repeated cancellation notifies once;
- cancelling prepared audio cannot be undone by a late start;
- cancellation prevents later service-size segments, including after a stale ended event;
- live queue cancellation aborts current/prefetched requests and disposes late audio;
- ordered completion releases each URL, and synthesis failure stops later phrases.

The combined eight-file speech selection passes **68/68**, 0 skipped, with serial execution in approximately 2.61 seconds. [Lifecycle evidence](evidence/frontend-speech-lifecycle.log). A targeted TypeScript `--noEmit --strict` check of the new test and its imports also passes. No served build artifacts were generated.

These checks cover the adapter/queue boundary, not mounted React manual/live/preview arbitration, browser device behavior, or native worker cancellation latency. Those remain open. The active-training restriction remains in effect.

| Flow | Status / needed evidence |
|---|---|
| Existing launcher -> served UI/API/assets | NOT RUN; use current launcher, not a hand-created replacement service |
| Login/account separation/history reload/fork | Source inspected; runtime NOT RUN |
| Local text + tools + cancel + reconnect | Relevant code/tests exist; full live flow NOT RUN |
| External/media direct streaming vs durable runs | Explicit route difference inspected; cross-path live behavior NOT RUN |
| VoiceForge discovery/model/voice/RVC selection | Mocked tests pass; live service/catalog NOT RUN |
| Mic -> ASR -> composer; correction/history | Unit/source inspection only; live microphone NOT RUN |
| Read-aloud/live incremental speech/preview conflicts | Queue tests pass; browser audio arbitration NOT RUN |
| Abort during synthesis/playback and late result disposal | Code traced and component-level tests pass; native worker latency NOT MEASURED |
| Private Tailnet HTTPS | NOT RUN |
| Hardware/model performance budgets | NOT MEASURED |
| ErisHub/VoiceForge service builds/tests | NOT RUN; source/reference audit only |

Do not substitute build success or mocked tests for these acceptance checks.

## Code editor verification (September 24)

Final focused selection: 18 backend tests and 10 frontend tests pass; production TypeScript/Vite build passes. Installed launcher and live health/API authentication checks also exercised. A missing Pydantic import found during startup was fixed and covered by the route registration test. Authenticated browser editing/Git checks remain pending sign-in. Evidence and scope: [12-code-editor-integration.md](12-code-editor-integration.md).
