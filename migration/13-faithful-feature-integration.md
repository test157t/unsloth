# ErisHub feature integration — current checkpoint

Updated 2026-10-01. This supersedes earlier descriptions of the reduced Companion
and Code pages as fulfilling the requested ErisHub integration. The dedicated
companion area is for the actual VRM avatar and hypnosis presentation, alongside
Studio's existing conversation. The requested source behavior remains the target.

## Source and boundaries

- Avatar stage, Embody settings and hypnosis settings: adapted from ErisHub's
  corresponding React components under `studio/frontend/src/features/companion/eris`.
- VRM renderer and its THREE/VRM dependencies: vendored in
  `studio/frontend/public/companion-runtime`, with asset URLs routed through Studio's
  authenticated companion asset endpoint. Model files remain in the private
  `~/.unsloth/companion/assets` directory.
- Hypnosis presentation was extracted from ErisHub with
  `migration/scripts/extract-hypnosis.mjs`. Speech uses Studio's existing playback
  owner. The extracted session controller is not yet connected to a complete session UI.
- Code page uses ErisHub's editor composition adapted to Studio's projects, file/Git
  tools, inference and persistent chat. It is not an independent conversation service.

## Selected VRM repair

The saved selection was `/assets/vrm/models/Mia.vrm`; that file was present and
loaded successfully. The copied stylesheet still forced the canvas to the full
browser viewport, overriding the pane styles. The renderer also resized its camera
to the window rather than the pane. This clipped and misplaced the avatar in Studio.

- Canvas positioning now belongs to its containing pane. A ResizeObserver updates
  renderer resolution and camera aspect when the pane changes size; the runtime's
  window-resize handler also measures the containing pane.
- Scene loading, model changes, settings updates and teardown share one serialized
  queue. A late load can no longer overlap cleanup and overwrite a newer selection.
  Stage ownership prevents an old pane from hiding a different pane's canvas.
- Settings and preview use the same selected-profile resolver, including when a
  previously selected profile no longer exists. Companion and Code pass their actual
  profiles to the avatar adapter.
- Saved model transforms and configuration were not rewritten.

## Verification and limits

- Three focused lifecycle/profile regression tests pass.
- Production frontend build passes (existing CSS highlight and bundle-size warnings).
- Isolated loopback browser fixture uses the actual saved VRM settings and Mia.vrm.
  Checked rendering, rapid alternate-model selection followed by Mia, disable/re-enable,
  and resizing. The fixture runs React StrictMode and does not write saved settings.
- This is renderer verification, not an authenticated end-to-end Studio acceptance
  test. The production Studio process was not started or stopped during this repair.
- Hypnosis session orchestration, complete design-document acceptance and full
  editor integration acceptance remain outstanding. Do not describe the overall
  migration as complete.

Reproduce: from `studio/frontend`, run `node scripts/serve-companion-smoke.mjs`,
then open `http://127.0.0.1:8897/smoke-companion.html`. This development-only fixture
reads the local saved avatar configuration and serves local avatar assets over
loopback; stop it after verification. It is not part of the production entry point.

### Follow-up: production security policy and embedded textures

The initial isolated check omitted Studio's Content-Security-Policy. With the same
`connect-src 'self'` and `img-src 'self' data: blob:` restrictions, Mia.vrm reproduced
the reported `WARNING: no avatar for Mia after loadAllModels`. THREE's default
ImageBitmapLoader fetches embedded texture blob URLs; the connection policy blocks
those fetches. Missing textures then cause the VRM material plugin's `colorSpace`
assignment to fail. Server logs showed that the model file itself returned HTTP 200.

The VRM parser now uses THREE.TextureLoader, decoding embedded textures through
images under the existing image policy. Studio's security policy was not widened.
The same restricted browser fixture now displays the textured avatar and reports
`Avatar loaded for Mia (VRM 1)`. Runtime version is `studio-vrm-59`. Loading errors
now propagate to the stage instead of being swallowed, and remain visible when
debug status is disabled. Error text redacts asset query tokens.
