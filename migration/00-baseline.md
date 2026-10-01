# Baseline

## Source identity

| Source | Location | Revision |
|---|---|---|
| Production Unsloth fork | `D:/Github/unsloth` | `78a2485b7a8b7784abdfb03da5bd072cff8c4385` (`main`) |
| Local canonical upstream reference | `upstream/main` | `ba18ca78a7ecd97ee794b0cfe31c37b323ed008f` |
| ErisHub | `D:/Github/ErisHub` | `cec8768135d22216aa166c755bc19a27a857509a` |
| VoiceForge | `D:/Github/VoiceForge` | `fd5f2e6e9529ed173e56be841337bb740080ed8e` |
| Additional call prototype | `D:/Github/Video-chat` | `1cfad643d1d9155e1418fd6d01bad4f73c927611` |

Unsloth origin: `https://github.com/test157t/unsloth.git`.
Upstream: `https://github.com/unslothai/unsloth`.
Merge base equals the recorded upstream ref. `git rev-list --left-right --count upstream/main...HEAD` returned `0 45`. This says nothing about upstream commits not yet fetched. No fetch, branch change, worktree creation, history rewrite, or service restart was performed.

Unsloth, ErisHub, and VoiceForge returned empty `git status --short` at the start. `git worktree list --porcelain` showed only `D:/Github/unsloth`. Local ignored workflow/data directories are not represented by this clean Git status and must be preserved.

## Runtime/build baseline

- Frontend: existing Node `v22.17.0`, installed `studio/frontend/node_modules`.
- `npm.cmd run build`: passed (`tsc -b && vite build`). Vite reports CSS `::highlight` optimizer warnings and bundles over 500 kB; the chat chunk is approximately 2.05 MB minified / 615 kB gzip. Build success is not a scroll/interaction performance measurement.
- Repo `.venv` uses Python 3.12.11 and lacks pytest. This is not the Studio runtime used for successful backend tests.
- Existing Studio runtime: `C:/Users/xmgha/.unsloth/studio/unsloth_studio/Scripts/python.exe`, configured for Python 3.11.6. It ran the focused backend suite successfully.
- The sandbox initially denied access to the underlying Python executables. Both files exist. Approved execution outside the sandbox resolved that restriction; do not diagnose this as a broken Python installation.
- Full backend startup, real model inference, browser microphone, speech output, remote Tailnet access and latency measurements were not exercised. Existing running Python processes were left alone.

See [08-regression-baseline.md](08-regression-baseline.md) for exact commands and results.

## Scope and integrity

Only the supplied design copy, migration notes, and audit evidence are added. Frontend build refreshed ignored generated assets. No saved configuration, account data, credentials, model files, provider endpoints, or database schemas were edited. No external services were contacted by the mocked speech tests.

No applicable filesystem `AGENTS.md` was found in the Unsloth tree search; the owner's conversation instructions still apply. ErisHub's `AGENTS.md` and VoiceForge's `RULES.md` were read before source tracing. Their no-duplicate/no-fallback rules are relevant to any later edits there; this pass did not change either repository.
