Current status (September 24): [implementation checkpoint](11-companion-implementation.md). Training has finished; the audit and deferred-work statements below record the earlier baseline.

# Durable decisions and interpretations

## D01 — Evolve the existing Unsloth project in place (accepted)

Owner: prefer building inside the existing improved Unsloth project because groundwork already exists. Verified source supports that preference. Production remains `D:/Github/unsloth/studio/{backend,frontend}`. ErisHub and VoiceForge remain inspectable sibling repositories/services. This supersedes the design's suggested physical `app/` / `legacy/` seed layout, not its preservation/provenance/ownership invariants.

No new repository, linked worktree, second production app, or bulk copy is required.

## D02 — Dedicated companion area inside Studio (accepted)

Owner answer during this audit: **Dedicated companion area inside Studio**. Training, Recipe Studio and existing general chat remain available. The companion is a product area using the same backend and conversation infrastructure.

## D03 — Preserve VoiceForge as the existing speech provider (design + source evidence)

Extend the existing custom provider, dictation and synthesis adapter paths. Speech ownership work may introduce a small coordinator around them, but cannot become a second ASR/TTS client, provider registry or conversation engine.

## D04 — Typed immersive presentation; preserve ordinary Studio artifacts (scoped interpretation)

General Studio already supports HTML/JS artifacts in sandboxed iframes. Removing that whole capability is not implied by adding a dedicated companion area. The companion's MediaStage must implement the design's typed action boundary and cannot run generated HTML/JS/CSS as immersive presentation. Companion tool selection must be explicit; sharing the backend does not require exposing every general Studio tool to a session.

This is the proposed way to satisfy both the accepted product scope and the presentation invariant. It is not evidence that an iframe fulfills the typed command requirement.

## D05 — No ownership replacement from names alone (design invariant)

Existing generation supervisor/storage, tool loop controller, MCP host and inference supervisors take priority over new classes matching illustrative design names. Local/external/media capability differences must be characterized before consolidation.

## D06 — Audit boundary

This pass produces source-backed migration notes and baseline checks. It does not silently implement future design directives, delete existing code, change saved settings, repair unrelated tests, or declare live performance targets met. The next proposed slice is baseline harness repair and runtime characterization.

## D07 — Protect the active training run (accepted follow-up constraint)

The owner authorized continued work while requiring that the active Studio training run not be disturbed. The test-only speech fixture repair is complete (61/61 selected tests pass). Defer live launcher/chat/speech/model validation, served frontend rebuilds and runtime changes until training is known to be finished. Continue read-only source tracing and lightweight isolated tests as appropriate. Do not infer training completion from elapsed time.

## Code tab decision (September 24)

Owner request: scope and integrate ErisHub's code editor as a Studio tab and update the relevant Markdown. Implemented as `/code` with existing Studio chat/workspace owners. Initial scope and explicit remaining capabilities are in [12-code-editor-integration.md](12-code-editor-integration.md). This adds Code alongside Companion; it does not replace Companion or general Studio.
