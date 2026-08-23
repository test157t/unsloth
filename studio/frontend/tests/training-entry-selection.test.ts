// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import { selectedTrainingEntryStep } from "../src/features/studio/training-entry-selection.ts";

test("a pinned step stays selected when hover leaves", () => {
  assert.equal(selectedTrainingEntryStep(null, 12, 30), 12);
});

test("hover temporarily previews over a pin and latest follows without either", () => {
  assert.equal(selectedTrainingEntryStep(18, 12, 30), 18);
  assert.equal(selectedTrainingEntryStep(null, null, 30), 30);
});
