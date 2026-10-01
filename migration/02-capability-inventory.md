# Capability inventory

Evidence levels: **traced** means selected source/callers inspected; **inventory** means registry/files identified without end-to-end tracing. Passing focused tests is recorded separately, not implied by either level.

## Target ownership

| Capability | Strongest observed source | Proposed owner and classification | Evidence |
|---|---|---|---|
| Model load/unload, llama process, readiness | Unsloth | Existing inference backend: KEEP | traced: `studio/backend/core/inference/{__init__,orchestrator,llama_cpp}.py` |
| Streaming/API adapters | Unsloth | Existing routes/backend: KEEP + extend events only as needed | traced: `main.py`, `routes/inference.py` |
| Conversations/history | Unsloth | `storage/studio_db.py` with existing routes: KEEP | traced route imports and storage authority |
| Durable generation state | Unsloth | Existing producer/supervisor/DB: KEEP + scope-aware extension | traced: `core/inference/chat_generation_runs.py`, matching route/storage |
| Agent tools and approvals | Unsloth | Existing loop controller, dispatcher/policy: KEEP + REFACTOR only with evidence | traced shared symbols/callers |
| MCP hosting | Unsloth | `core/inference/mcp_client.py`: KEEP | traced account-scoped sessions, cache, cancellation; focused tests pass |
| Provider connections | Unsloth | Existing provider storage/client: KEEP | speech route/client traces |
| ASR and TTS | Unsloth + VoiceForge | Existing speech adapters/config plus VoiceForge service: KEEP + REFACTOR | detailed speech trace in 01 |
| Speech catalogs/voice/RVC | Unsloth + VoiceForge | Existing provider client; share UI discovery data: KEEP + REFACTOR | selectors/options endpoint traced |
| Files/images/audio/video | Unsloth | Existing attachment/gallery/sandbox services: KEEP + target ownership audit | inventory of attachment adapters, galleries, routes |
| Retrieval/context | Unsloth; ErisHub reference | Existing context/RAG first: KEEP; evaluate memory behavior separately | context helpers/RAG routes; ErisHub summary hook inspected |
| Persona/prompts | Unsloth + ErisHub behavior | Extend existing prompts/settings for companion profile | personalization storage/route traced; full prompt precedence still UNKNOWN |
| Immersive session presentation | ErisHub behavior | New companion feature within Studio: PORT BEHAVIOR | `hypno.ts`, action declarations and registry traced |
| Voice call UX/turn behavior | ErisHub, Video-chat | PORT BEHAVIOR, using existing Studio speech/conversation | call module, browser call code inventory, Video-chat pipeline traced |
| Video/WebRTC | No verified reusable Studio owner | DEFER; add transport adapter under same session | Studio symbol/route searches found no target coordinator |
| Diagnostics/performance | Unsloth | Existing API monitor and health: KEEP + extend | TTFT calculation found in `api_monitor.py` |
| Auth/private deployment | Unsloth | Existing auth/account model + deployment verification | JWT/API-key helpers, default loopback and optional LAN listener |
| Training/recipes | Customized Unsloth | KEEP unchanged during companion work | fork delta groups; existing area retained by owner decision |

## ErisHub salvage inventory

`server/modules/registry.ts` registers assets, background music, classification, computation, relationship meter, VoiceForge, call mode, SIP, evolution, VRM, Intiface, hypnosis, llama, events, permissions, organizer, memory bank, web search, contacts/projects, summaries, environmental context, image generation and Discord.

| Candidate | Evidence / coupling | Disposition |
|---|---|---|
| Hypnosis stage/configuration/checkpoints, spirals, whisper cues, particles, choices | `hypno.ts` declares corresponding `hypno.*` actions and prompt guidance | PORT BEHAVIOR into typed companion actions; do not copy its state/dispatch architecture |
| Background media/assets | `backgroundMusic.ts`, `backgroundAssets.ts`, `assetsModule.ts` | Candidate PORT BEHAVIOR; inspect media lifecycle and ownership before selecting code |
| Call overlay, input selection, silence/noise settings | `callMode.ts`, `Embody/callmode/call-mode.js` | Candidate PORT BEHAVIOR; current settings include a direct ASR endpoint, incompatible with adding a second speech config authority |
| Memory/session summaries/environment | `sessionSummary.ts`, `knowledge.ts`, `memory.ts`, `environmentalContext.ts` | DEFER until desired scope and current Studio context behavior are mapped. Summary hook's latest-summary selection needs conversation scoping review. |
| Tool registry/action bus | `toolRegistry.ts` delegates to `actionBus.ts`, which imports many unrelated domain modules | Do not port dispatcher. Adapt chosen behaviors through Studio's existing tool execution/policy. |
| llama/provider runtime, VoiceForge client | `llamaCpp.ts`, `providerCompletion.ts`, `voiceforge.ts` | Reject as a second runtime authority inside Studio; retain source for reference |
| Discord/SIP, VRM, Intiface, relationship/evolution, organizer | Registry-level inventory only | DEFER; not automatic companion MVP scope |

## VoiceForge boundary

`app/servers/main_server.py` includes TTS/ASR/RVC/postprocess/file routers. `audio_contract.py` handles recognition proxying and serialized model work; `voice_catalog.py` supplies catalog constants. Model workers include ASR, OmniVoice, Kokoro and Pocket TTS. Keep provider internals inside VoiceForge.

Its README documents `voiceforge_ports.json` as the launcher/service port authority and a stable Tailscale HTTPS integration URL. No runtime config was read or changed here. Do not import worker ports into Studio settings; retain the saved main API connection.

## Additional local sources

`Video-chat/local_realtime.py` maintains its own `messages`, calls llama directly, invokes ASR/TTS directly, and sends base64 PCM over WebSocket events. These conflict with the target shared conversation core and future WebRTC media plane. Retain UI/turn-handling lessons; do not connect this bridge as a second companion engine.

`Mia Core MCP` and `comfyui` are present, but are optional integration candidates, not necessary core replacements. Their behavior was not audited here; use existing MCP/provider boundaries if later included.
