// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import { reconcilePersistedJobs } from "../src/features/recipe-studio/executions/persisted-job-reconciliation.ts";

type PersistedRun = {
  id: string;
  jobId: string | null;
  status: "active" | "cancelling" | "cancelled" | "completed";
  rows: number;
};

class MissingJobError extends Error {
  readonly status = 404;
}

const active = (
  id: string,
  status: PersistedRun["status"] = "active",
): PersistedRun => ({
  id,
  jobId: `job-${id}`,
  status,
  rows: 10,
});

const isMissing = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  error.status === 404;

const options = (
  getStatus: (
    jobId: string,
  ) => Promise<{ status: PersistedRun["status"]; rows: number }>,
) => ({
  jobId: (record: PersistedRun) => record.jobId,
  shouldReconcile: (record: PersistedRun) =>
    record.status === "active" || record.status === "cancelling",
  getStatus,
  applyStatus: (
    record: PersistedRun,
    status: { status: PersistedRun["status"]; rows: number },
  ): PersistedRun => ({ ...record, ...status }),
  isMissing,
  markMissing: (record: PersistedRun): PersistedRun => ({
    ...record,
    status: "cancelled",
  }),
});

test("every orphaned in-progress recipe run is made terminal after restart", async () => {
  const records = [active("1"), active("2", "cancelling"), active("3")];
  const requested: string[] = [];
  const reconciled = await reconcilePersistedJobs(
    records,
    options((jobId) => {
      requested.push(jobId);
      return Promise.reject(new MissingJobError("job not found"));
    }),
  );

  assert.deepEqual(requested.sort(), ["job-1", "job-2", "job-3"]);
  assert.deepEqual(
    reconciled.map((record) => record.status),
    ["cancelled", "cancelled", "cancelled"],
  );
});

test("terminal records are preserved without asking the backend again", async () => {
  const completed = active("done", "completed");
  const cancelled = active("stopped", "cancelled");
  const reconciled = await reconcilePersistedJobs(
    [completed, cancelled],
    options(() =>
      Promise.reject(new Error("terminal records must not be queried")),
    ),
  );

  assert.equal(reconciled[0], completed);
  assert.equal(reconciled[1], cancelled);
});

test("transient status failures do not falsely cancel a persisted run", async () => {
  const record = active("1");
  const reconciled = await reconcilePersistedJobs(
    [record],
    options(() => Promise.reject(new TypeError("Failed to fetch"))),
  );

  assert.equal(reconciled[0], record);
  assert.equal(reconciled[0]?.status, "active");
});

test("a live backend snapshot updates the cached display", async () => {
  const reconciled = await reconcilePersistedJobs(
    [active("1")],
    options(() => Promise.resolve({ status: "active", rows: 42 })),
  );

  assert.equal(reconciled[0]?.status, "active");
  assert.equal(reconciled[0]?.rows, 42);
});
