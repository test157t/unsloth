# Design versus implementation gap ledger

Statuses describe audited code, not live deployment certification. SATISFIED_DIFFERENT_SHAPE means the invariant has an existing implementation worth retaining. UNKNOWN requires more evidence. MISSING below means not found in the stated source search, not a claim about every ignored file or external service.

## MVP / core requirements

| ID / design section | Requirement | Status | Evidence and gap | Action / completion proof |
|---|---|---|---|---|
| G01 / 5, 38 | FastAPI + React Studio foundation | SATISFIED_DIFFERENT_SHAPE | `studio/backend/main.py`, frontend package/build; owner chose in-place layout | KEEP; no `app/` relocation |
| G02 / 7–8 | Replaceable inference, supervised llama | PARTIAL | Existing orchestrator/llama backend; capability boundary spans routes and backends | KEEP; map actual capabilities before interface extraction |
| G03 / 36.1–2, 18 | Private HTTPS/Tailnet and loopback deployment | UNKNOWN | Default loopback and optional LAN listener exist; live TLS/proxy identity/config not checked | Verify current launcher and private URL from another authorized device; no new public exposure |
| G04 / 36.3, 10 | Smooth streaming/premium UI | PARTIAL | Existing chat/runtime/stream pacing; build passes; no frame/latency measurement | Add dedicated companion area with measured long-chat/tool/media responsiveness |
| G05 / 36.4, 17 | Persistent conversations | SATISFIED_DIFFERENT_SHAPE | SQLite `studio_db`, authenticated chat routes | KEEP; exercise reload/fork/delete before session integration |
| G06 / 36.5, 13 | OpenAI-compatible API + keys | PARTIAL | Existing dual-mounted `/v1` routes/auth; speech/transcription round trips tested with mocked work | KEEP; validate live chat streaming/key scopes |
| G07 / 36.7, 15 | stdio + Streamable HTTP MCP | PARTIAL | Existing session host; selected HTTP/stdio session tests pass, one backend-suite test skipped | KEEP; actual external fixture/transport acceptance remains to be recorded |
| G08 / 36.8, 14 | Application-enforced tool policy | PARTIAL | Dispatcher/policy/controller already exist | Reuse; companion presentation allowlist and cancellation still needed |
| G09 / 36.9, 16 | File sandbox cannot escape | PARTIAL | Path checks and platform confinement exist; owner context is unconfined at OS layer; managed confinement implements Linux/macOS, not Windows | Define permitted companion file operations and test Windows boundary. Do not claim regex/path checks confine arbitrary owner shell execution. |
| G10 / 36.10–11, 21 | Images/VLM and explicit unsupported capability | PARTIAL | Attachment/video/audio adapters, model routes exist | Validate selected profiles and file ownership; do not duplicate asset stores |
| G11 / 36.12, 50 | Typed spiral/image/video MediaStage | MISSING | No target symbols/session routes in Studio; general HTML artifacts exist; ErisHub has relevant behavior | PORT BEHAVIOR into a typed, session-scoped renderer |
| G12 / 36.13, 60 | Always-available Stop Session/Clear Media | MISSING | No companion session owner/hard-stop contract found; run/speech cancellation exists separately | Implement immediate local stop plus idempotent server cancellation and stale-event rejection |
| G13 / 36.14, 48 | Run cancellation/late result suppression | PARTIAL | Existing generation supervisor and cancellation tests; speech queue cancellation passes | Extend existing run IDs/ownership to sessions; test late tools/media and reconnect |
| G14 / 36.15, 28 | Diagnostics | PARTIAL | API monitor computes TTFT; inference/MCP status exists | Add session/speech correlation and hardware-specific baseline |
| G15 / 36.16, 20–23 | Shared call-ready domain | PARTIAL | Reusable conversation/run/speech infrastructure; no target realtime coordinator found | Add session orchestration; reuse current stores and tools |
| G16 / 24, 64 | Persistent companion persona profile | PARTIAL | Existing prompts/personalization; no verified scoped companion profile authority | Extend existing configuration after tracing prompt precedence; device mic/output stays local |
| G17 / 11, 48, 52 | Unified event ownership/durability | PARTIAL | Durable local text runs reject external and inline media; legacy streaming remains active for those capabilities | Explicit capability mapping; session facade delegates, never creates another conversation store |
| G18 / 19, 60 | Session permissions/lifecycle | MISSING | No active immersive session model found in searched Studio routes/storage | New minimal session record referencing existing account/thread/run; no independent assistant engine |
| G19 / 3.10, 14.4 | No generated executable presentation | WRONG_OWNER | `render_html` and sandboxed `allow-scripts` artifact iframe intentionally exist in general Studio | Companion MediaStage accepts declared actions only. Preserve general Studio artifacts; companion tool availability is explicit. |
| G20 / 5.6, 45 | No runtime imports from source snapshots | SATISFIED_DIFFERENT_SHAPE | No `legacy/` relocation introduced; existing app stays in place | Later provenance/import checks must prevent cross-repo source imports |

## Speech and realtime

| ID | Requirement | Status | Evidence / smallest action |
|---|---|---|---|
| S01 | VoiceForge ASR/dictation | SATISFIED_DIFFERENT_SHAPE | Existing custom dictation -> application proxy -> VoiceForge -> ASR. Preserve; live recording test open. |
| S02 | Incremental read-aloud | SATISFIED_DIFFERENT_SHAPE | `LiveSpeech` + queue + shared adapter; focused behavior tests pass. Complete audio buffered per phrase, not continuous audio streaming. |
| S03 | Voice/RVC/catalog selection | SATISFIED_DIFFERENT_SHAPE | Options proxy/client/selectors + shared settings shortcut; RVC backend tests pass. |
| S04 | Single catalog cache/selection authority | PARTIAL | Two selector instances own independent fetch state; one voice store and provider client underneath. Share discovery data if extracting this UI. |
| S05 | One speech playback owner | PARTIAL | Manual read-aloud and live queue share adapter; cross-entrypoint arbitration not fully tested. Consolidate ownership before call mode. |
| S06 | Transport cancellation | PARTIAL | Browser abort, backend disconnect watchers, VoiceForge task cancellation traced; native work preemption not guaranteed. Measure actual stop latency. |
| S07 | Barge-in/VAD/turn coordinator | MISSING | Dictation silence segmentation exists, but no shared conversation call-turn coordinator found. Reuse capture/ASR; add coordination only. |
| S08 | Utterance IDs/spoken transcript | MISSING | Live speech state tracks message IDs; no server playback acknowledgements/played-text accounting found. Add on same conversation/session. |
| S09 | Cross-device speech defaults | PARTIAL | Voice preferences are browser localStorage; provider configuration has backend authority. Specify account/profile defaults versus device settings. |
| S10 | WebRTC voice/video | MISSING | No Studio realtime provider symbols found; Video-chat prototype uses PCM WebSockets and its own history. DEFER transport until shared session path works. |
| S11 | Camera frame sampling/privacy | UNKNOWN | Inference video preprocessing exists but no verified live camera session path. Inspect before new observation code. |

## Other requirements and open evidence

- Context/summaries/RAG: PARTIAL. Existing helpers/routes must be mapped before using ErisHub memory. Conversation-scoped summaries and spoken-vs-generated context are not established.
- Assets/uploads: PARTIAL. Existing multipart attachments and galleries are stronger starting points than a new generic asset DB; deduplication, derivatives, ownership and large-upload budgets remain unmeasured.
- Scheduling: UNKNOWN for companion sessions. ErisHub scheduler/reminders are inventory-only; do not silently add proactive behavior.
- Backup/schema migration: UNKNOWN at product level; preserve existing data, map migration hooks before new session tables.
- Accessibility/responsive/PWA: UNKNOWN as an acceptance result; frontend build is not accessibility or device QA.
- Performance: UNKNOWN against design budgets; no GPU load/TTFT/stop or media benchmark was run.
- Licenses for copied ErisHub/VoiceForge code: UNKNOWN; no root license was found by tracked-license inventory. Reuse behavior now; review provenance before copying code.
- Training/Recipe Studio: existing fork capabilities, out of companion scope and protected from incidental rewrites.

## Search record

Searched Studio routes, storage, inference, frontend components/chat/settings for `MediaStage`, `Stop Session`, `session.ended`, `RealtimeProvider`, `LiveKit`, `RTCPeerConnection`, `presentation.command`, `render_html`, voice/call/speech names, endpoint paths, cancellation, registry wiring and Git delta paths. Inspected `main.py` router mounting, chat runtime speech mounting, backend provider and tool-loop imports, ErisHub module registry, VoiceForge main/router composition and Video-chat direct provider calls.

Absence classifications are restricted to the target shared session/presentation implementations. Similar features under other semantics, generated media, and arbitrary HTML artifacts are not treated as equivalent.
