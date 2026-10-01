# Upstream synchronization — October 1, 2026

- Integrated upstream `1d4727cf2` (706 commits since the previous merge).
- Merge commit: `3215fbbeee8d4b896c6b58818124ea8ad3e1ab7a`.
- Published to `test157t/unsloth` main; remote ref verified after the push.
- Recovery branch: `codex/pre-upstream-2026-10-01`, at `78a2485b7`.
- Uncommitted-work backup retained: stash `9e4cf418f6ee68d99b9b7e4a0cf546358013dd17`.
  Its 593 untracked files were all restored with matching Git blob hashes before
  the two speech-test harness imports were updated for the restored analyser module.

## Reconciliation

VoiceForge discovery/root URL handling, optional external sampling, reasoning-preserving
training, recipe repair/checkpoint functionality, Gothic Glass and disabled GitHub
Actions remain. Gothic Glass is registered alongside the built-in themes in the new
upstream theme selector. Upstream's managed loopback handling and added provider APIs
were retained alongside VoiceForge.

Upstream's recipe library now owns recipe and execution persistence. The fork's
account-scoped `data-recipes/saved-recipes.sqlite3` is read-only input to a transactional,
once-per-account migration into `studio.db`; source files remain unchanged. ID collisions
retain both versions. Import receipts and execution tombstones prevent deleted data
from returning through stale imports or queued writes. Existing `/saved` endpoints
forward to this same store, rather than maintaining a second writable database.

The companion/editor work was reapplied after the merge and remains uncommitted.
Its navigation imports were combined with upstream's command palette and temporary-chat
features. The obsolete Manage Chats component was removed because upstream replaced
it with the Library; the original component remains recoverable from the stash.
No Studio process was restarted and no live account database migration was triggered.

## Verification

- 78 backend tests: migration preservation/collisions/isolation, recipes, VoiceForge,
  sampling, reasoning templates and run deletion.
- 131 backend tests: restored companion/editor integration and account tool isolation.
- 63 frontend tests across theme, sampling, server recipe persistence, reasoning,
  companion routing/lifecycle, editor, speech playback and connection policy suites.
- Production frontend build passed after restoring the companion/editor work.
- No unresolved conflicts; working-tree `git diff --check` passed.
- Upstream is an ancestor of local main, with zero upstream commits missing.

This was focused merge validation, not a complete GPU training or authenticated UI
acceptance run. Existing CSS highlight/bundle-size and Python environment warnings
remain. Full migration/feature acceptance described in checkpoint 13 is still open.
