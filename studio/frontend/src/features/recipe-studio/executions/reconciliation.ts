// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { JobStatusResponse } from "../api";
import type { RecipeExecutionRecord } from "../execution-types";
import {
  isExecutionInProgress,
  markExecutionUnavailable,
  sortExecutions,
} from "./execution-helpers";
import { reconcilePersistedJobs } from "./persisted-job-reconciliation";
import { applyExecutionStatusSnapshot } from "./runtime";

export async function reconcileHydratedExecutions(
  records: RecipeExecutionRecord[],
  getStatus: (jobId: string) => Promise<JobStatusResponse>,
  isMissing: (error: unknown) => boolean,
  now: () => number = Date.now,
): Promise<RecipeExecutionRecord[]> {
  const reconciled = await reconcilePersistedJobs(records, {
    jobId: (record) => record.jobId,
    shouldReconcile: (record) => isExecutionInProgress(record.status),
    getStatus,
    applyStatus: applyExecutionStatusSnapshot,
    isMissing,
    markMissing: (record) => markExecutionUnavailable(record, now()),
  });
  return sortExecutions(reconciled);
}
