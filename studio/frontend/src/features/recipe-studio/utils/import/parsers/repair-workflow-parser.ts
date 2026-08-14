// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { ExpressionConfig } from "../../../types";
import { readString } from "../helpers";

export function parseRepairWorkflow(
  column: Record<string, unknown>,
  name: string,
  id: string,
  expressionType:
    | "conversation_pair"
    | "repair_tasks"
    | "repair_check"
    | "repair_merge",
): ExpressionConfig {
  return {
    id,
    kind: "expression",
    name,
    drop: column.drop === true,
    expr: "",
    dtype: "str",
    // biome-ignore lint/style/useNamingConvention: ui schema
    expression_type: expressionType,
    // biome-ignore lint/style/useNamingConvention: ui schema
    human_column: readString(column.human_column) ?? "",
    // biome-ignore lint/style/useNamingConvention: ui schema
    assistant_column: readString(column.assistant_column) ?? "",
    // biome-ignore lint/style/useNamingConvention: ui schema
    uuid_column: readString(column.uuid_column) ?? "row_uuid",
    // biome-ignore lint/style/useNamingConvention: ui schema
    judge_column: readString(column.judge_column) ?? "",
    threshold:
      typeof column.threshold === "number" ? String(column.threshold) : "4",
    // biome-ignore lint/style/useNamingConvention: ui schema
    conversations_column: readString(column.conversations_column) ?? "",
    // biome-ignore lint/style/useNamingConvention: ui schema
    candidate_column: readString(column.candidate_column) ?? "",
    // biome-ignore lint/style/useNamingConvention: ui schema
    approval_column: readString(column.approval_column) ?? "",
  };
}
