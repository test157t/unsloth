// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import {
  isExecutionInProgress,
  canResumeExecution,
  mapJobStatus,
} from "../src/features/recipe-studio/executions/execution-helpers.ts";

test("paused recipe jobs remain live and resumable", () => {
  assert.equal(mapJobStatus("pausing"), "pausing");
  assert.equal(mapJobStatus("paused"), "paused");
  assert.equal(isExecutionInProgress("pausing"), true);
  assert.equal(isExecutionInProgress("paused"), true);
});

test("resume requires a stopped worker and a backend-validated checkpoint", () => {
  const execution = { jobId: "saved", kind: "full", can_resume: true };
  for (const status of ["paused", "error", "cancelled"] as const) {
    assert.equal(canResumeExecution({ ...execution, status } as Parameters<typeof canResumeExecution>[0]), true);
  }
  for (const status of ["pausing", "active", "completed"] as const) {
    assert.equal(canResumeExecution({ ...execution, status } as Parameters<typeof canResumeExecution>[0]), false);
  }
  assert.equal(canResumeExecution({ ...execution, status: "error", can_resume: false } as Parameters<typeof canResumeExecution>[0]), false);
});
