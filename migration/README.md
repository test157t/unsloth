# Companion convergence and implementation

**Current checkpoint: [faithful ErisHub integration and selected VRM repair](13-faithful-feature-integration.md).**
The September 24 descriptions below are historical; they do not establish completion
of the requested avatar, hypnosis or editor integration.

**Code tab scope and delivery: [Code editor integration](12-code-editor-integration.md).** File editing, shared chat and Git controls are integrated; live UI verification awaits sign-in.

**Companion implementation status: [September 24 checkpoint](11-companion-implementation.md).** Companion route and shared speech playback ownership are implemented; authenticated browser verification remains pending sign-in. Training has finished, as explicitly confirmed by the owner.

Historical audit date: 2026-09-23 (America/New_York). Production home: `D:/Github/unsloth`.

The audit below records the initial source-backed archaeology and planning pass. Production changes made subsequently are recorded in the current checkpoint above. `../DESIGN.md` is an unchanged copy of the supplied expanded v0.03 design. Read the accepted overrides in [07-decisions.md](07-decisions.md) alongside it.

The owner explicitly selected a **dedicated companion area inside existing Studio**. Keep `studio/backend` and `studio/frontend`; preserve training, Recipe Studio, general chat, saved connections, and existing history. The illustrative `app/` and `legacy/` relocation is not the chosen implementation strategy.

## Read order

1. [Baseline and source revisions](00-baseline.md)
2. [Fork delta and speech call paths](01-unsloth-fork-delta.md)
3. [Capability inventory](02-capability-inventory.md)
4. [Design gaps](03-design-implementation-gap.md)
5. [Authority and duplication ledger](04-duplicate-authorities.md)
6. [Proposed implementation slices](05-convergence-plan.md)
7. [Provenance](06-provenance.md), [decisions](07-decisions.md), [regression evidence](08-regression-baseline.md), [deletion ledger](09-deletion-ledger.md)
8. [Playback ownership follow-up](10-speech-playback-ownership.md)

## Important findings

- Studio already has inference supervision, authenticated APIs, persisted chat history, durable local text runs, tool approval/execution, MCP sessions, and integrated VoiceForge ASR/TTS. Reuse these authorities.
- Existing speech is incremental text-to-audio **per phrase**, with complete audio responses buffered per request. It is not a continuous duplex call transport.
- Durable runs currently reject external-provider requests and inline media. A general session coordinator cannot assume all chat paths have the same durable contract.
- Live speech and manual read-aloud share a synthesis adapter, but have different playback entry points. Audit mutual exclusion before introducing call playback.
- Companion immersive presentation, a server-owned session lifecycle, and a cross-layer Stop Session contract were not found in the searched Studio paths.
- Generated HTML/JS artifacts already exist in general Studio. The new companion MediaStage must use typed actions; retain existing general Studio functionality while deciding companion tool availability explicitly.
- Frontend production build passes. Focused backend tests: 211 passed, 1 skipped. Expanded frontend speech selection now passes **68/68** after the test-only VoiceForge import repair and seven adapter/queue lifecycle tests; the original 52-pass/9-fail baseline is retained in the evidence log.

Historical constraint (lifted September 24): the owner reported an active Studio training run during slice 0. While it was running, work is limited to source inspection, documentation and lightweight isolated frontend tests. Do not restart/reload Studio, regenerate served assets, load models, invoke live speech/inference, change runtime settings or run GPU/backend integration checks.

## Gate status

| Gate | Status |
|---|---|
| 0: Workspace integrity | Source revisions, clean starting trees, one Unsloth checkout recorded. Source trees retained in place. External source license inventory remains incomplete. |
| 1: Baseline | Frontend build and focused tests executed; frontend harness repaired and adapter/queue lifecycle characterized (68/68). Live launcher/chat/speech/Tailnet/performance baseline remains deferred while training is active. |
| 2: Fork delta | Local upstream merge base, commit/file/stat views and key semantic traces recorded. No remote fetch; comparison is to the existing local upstream ref. |
| 3: Cross-repo inventory | Broad inventory and priority source traces complete; peripheral integrations explicitly deferred. |
| 4: Gaps and authorities | Initial ledger complete for major capabilities/MVP requirements. Unknowns are listed, not silently classified as missing. |
| 5: Plan | Proposed below; in-place location and dedicated companion area are accepted owner decisions. |
| 6: Implementation | Companion route/composition and basic shared speech ownership implemented; see September 24 checkpoint for verification and remaining scope. |

The remaining baseline work is live regression evidence before moving ownership. No deletion, new speech stack, or new inference supervisor is justified by this audit.
