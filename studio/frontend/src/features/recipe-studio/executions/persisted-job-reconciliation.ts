// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export function reconcilePersistedJobs<RecordType, StatusType>(
  records: RecordType[],
  options: {
    jobId: (record: RecordType) => string | null;
    shouldReconcile: (record: RecordType) => boolean;
    getStatus: (jobId: string) => Promise<StatusType>;
    applyStatus: (record: RecordType, status: StatusType) => RecordType;
    isMissing: (error: unknown) => boolean;
    markMissing: (record: RecordType) => RecordType;
  },
): Promise<RecordType[]> {
  return Promise.all(
    records.map(async (record) => {
      const jobId = options.jobId(record);
      if (!(jobId && options.shouldReconcile(record))) {
        return record;
      }
      try {
        return options.applyStatus(record, await options.getStatus(jobId));
      } catch (error) {
        return options.isMissing(error) ? options.markMissing(record) : record;
      }
    }),
  );
}
