# Provenance

No production source was copied from ErisHub, VoiceForge or Video-chat during this audit.

| Artifact | Origin | Treatment |
|---|---|---|
| `DESIGN.md` | `C:/Users/xmgha/Downloads/Mia/software-design-document-v0.03-expanded.md` | Byte-for-byte copy; SHA256 `C3E29CAEC500482DC9C6C61ECC573C81FDD748638F9D90DFDB60904860493FE8` |
| `migration/*.md` | Current source inspection and test output | New audit notes, not runtime configuration |
| `migration/evidence/fork-*` | Git comparison at recorded baseline refs | Commit/stat/name-status evidence |
| `migration/evidence/frontend-speech-extended.log` | Three additional existing frontend test files | Original failing harness evidence; no credentials included |
| `migration/evidence/frontend-speech-repaired.log` | Seven existing frontend test files after fixture repair | 61/61 pass; serial lightweight run during active training |
| `migration/evidence/frontend-speech-lifecycle.log` | Eight frontend test files, including new real-adapter/queue lifecycle tests | 68/68 pass; fake audio/HTTP, no live model work |

Studio source declares AGPL-3.0-only; retain its headers and `studio/LICENSE.AGPL-3.0`. Tracked license search in ErisHub found no license file. VoiceForge search found a model tokenizer license, not a project-root license. This is an incomplete provenance result, not a legal conclusion about reuse rights. Review source ownership and all relevant notices before copying code/assets from either source into production.

Source revisions and paths are in [00-baseline.md](00-baseline.md). The sibling repositories remain intact and inspectable; no mass snapshot copy or filesystem relocation was performed. References in these notes are documentary only, not imports.

## Code workspace provenance (September 24)

ErisHub's `src/components/editor/EditorPage.tsx`, `src/lib/tokenizer.ts` and project/Git API call sites were inspected as behavior/composition references. No source code, assets, stores or backend services were copied. The new Studio code editor and workspace operation module are original implementations; details and verification are in [12-code-editor-integration.md](12-code-editor-integration.md).
