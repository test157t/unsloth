# Code tab scope and integration — 2026-09-24

The owner requested scoping and integration of ErisHub's code editor as a Studio tab. This checkpoint extends the Companion work; it does not replace the remaining companion/session roadmap.

## Delivered scope

| Capability | Integration |
|---|---|
| Dedicated tab | `/code`, Code sidebar entry, authenticated route and chat-only-host access |
| Shared conversation | The existing persistent ChatPage remains beside the editor; history, provider selection, inference and tools stay in Studio |
| Workspace | Current Studio thread or project workspace, resolved by the same account-aware sandbox functions used by chat tools |
| File editing | Filterable file list, multiple open files, new text files, line numbers, lightweight syntax coloring, Save and Ctrl/Cmd+S, explicit Reopen |
| Draft protection | Drafts stay in memory across Studio navigation and workspace changes; dirty close/reopen prompts and browser-unload warning; no silent overwrite on save completion |
| Disk conflicts | SHA-256 revision checked before replacement; new-file name collisions and changed/deleted files return 409; temporary-file replacement preserves existing permission bits |
| Git | Status, staged/unstaged text diffs, stage, unstage (including before the first commit), commit staged changes with a message |
| Account boundary | Text operations use the existing account workspace resolver. Git requires owner context because repository hooks/filters execute on the backend host |

The editor handles regular UTF-8 files up to 2 MiB. It rejects linked paths, traversal, Windows device/alternate-stream names, and internal Studio/Git metadata. The existing bounded sandbox listing remains authoritative; no second filesystem crawler was added.

Git operates only when the workspace itself contains a regular `.git` directory. It does not discover a parent repository or follow a Git-directory link. Normal local Git configuration, identity, signing and hooks apply; failures/timeouts appear in the UI. The commit button commits all currently staged changes. No commit or push was performed in the user's repositories while implementing or verifying this feature.

## How to use

1. Open Studio and sign in, then select Code in the sidebar.
2. Open a conversation/project through the existing sidebar. A new conversation needs its first message before it has a persisted thread workspace.
3. Select a file or enter a relative filename and choose New. Save writes to the workspace shown above the file list.
4. Ask the adjacent Studio chat to inspect or change saved files through its existing tools and permissions. Refresh updates the file list and Git status; Reopen explicitly reloads an open file.
5. In a Git workspace, review a file's changes, stage the desired files, and use Commit staged changes.

## Authority and source treatment

ErisHub reference: `D:/Github/ErisHub/src/components/editor/EditorPage.tsx`, its tokenizer, project APIs and project/Git endpoint call sites. Its file rail, open-tab editor, Git review and adjacent-chat composition informed this implementation. No ErisHub source files or runtime APIs were copied/imported. The Studio implementation is newly written against existing Studio authorities.

- Frontend: `studio/frontend/src/features/code/` plus route registration and the persistent root composition.
- Backend: authenticated `POST /api/inference/code-workspace` on the existing Studio inference router; filesystem/Git operations in `core/code_workspace.py`.
- The API accepts session identity plus an enumerated action, never a client-selected absolute host root or arbitrary shell command.
- No new provider configuration, conversation history, project database, inference supervisor or terminal service.

## Explicitly outside this slice

Inline AI ghost-text completion, a separate run-code button, avatar/background preview, drag-resizable panes, persisted editor drafts across browser restarts, arbitrary host-directory selection, Git init/clone/push controls, Git worktrees with external metadata, rename/delete UI, and a full language server are not implemented here. Existing Studio chat tools remain the path for execution and repository setup. Companion MediaStage/session work remains separate.

Drafts are not silently sent to the model. Save first, then ask chat to read the named file. Moving a conversation between projects can leave its historical tool files in the old workspace; the editor follows the current workspace, while existing artifact/history UI still exposes prior outputs.

## Verification

- 18 backend tests pass: text roundtrip, new-file conflicts, stale external edits, unsafe names, binary rejection, workspace separation, symlink refusal, temporary-repository Git lifecycle, parent-repository refusal, and actual route registration/auth/input validation.
- 10 focused frontend tests pass: save acknowledgement preserving newer edits, workspace document identity, lossless syntax tokenization, route classification/navigation, chat-only guards.
- Production TypeScript/Vite build passes; existing chunk-size warnings remain.
- Installed Studio launcher verified. Startup revealed a missing Pydantic import, fixed before delivery. Live health returns 200; the new API returns 401 without authentication.
- Authenticated visual and click-through checks remain pending browser sign-in. No claim of a completed live edit/Git browser roundtrip is made.

Evidence: `evidence/code-backend-tests.log`, `evidence/code-frontend-tests.log`, `evidence/code-build.log`.
