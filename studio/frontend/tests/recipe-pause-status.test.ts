// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import {
  isExecutionInProgress,
  mapJobStatus,
} from "../src/features/recipe-studio/executions/execution-helpers.ts";

test("paused recipe jobs remain live and resumable", () => {
  assert.equal(mapJobStatus("pausing"), "pausing");
  assert.equal(mapJobStatus("paused"), "paused");
  assert.equal(isExecutionInProgress("pausing"), true);
  assert.equal(isExecutionInProgress("paused"), true);
});
