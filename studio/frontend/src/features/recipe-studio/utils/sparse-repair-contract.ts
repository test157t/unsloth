// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { ExpressionConfig, LlmType } from "../types/index.ts";

export function conditionalLlmColumnType(llmType: LlmType): string {
  return `unsloth-conditional-llm-${llmType}`;
}

export function buildSparseRepairColumn(
  config: ExpressionConfig,
): Record<string, unknown> | null {
  const expressionType = config.expression_type ?? "formula";
  if (expressionType === "formula") {
    return null;
  }
  if (expressionType === "conversation_pair") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-conversation-pair",
      // biome-ignore lint/style/useNamingConvention: api schema
      human_column: config.human_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      assistant_column: config.assistant_column?.trim(),
    };
  }
  if (expressionType === "conversation_extend") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-conversation-extend",
      // biome-ignore lint/style/useNamingConvention: api schema
      conversations_column: config.conversations_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      human_column: config.human_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      assistant_column: config.assistant_column?.trim(),
    };
  }
  const base = {
    name: config.name,
    drop: config.drop ?? false,
    // biome-ignore lint/style/useNamingConvention: api schema
    uuid_column: config.uuid_column?.trim(),
  };
  if (expressionType === "repair_tasks") {
    return {
      ...base,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-repair-tasks",
      // biome-ignore lint/style/useNamingConvention: api schema
      judge_column: config.judge_column?.trim(),
      threshold: Number(config.threshold ?? "4"),
    };
  }
  return {
    ...base,
    // biome-ignore lint/style/useNamingConvention: api schema
    column_type:
      expressionType === "repair_check"
        ? "unsloth-repair-check"
        : "unsloth-repair-merge",
    // biome-ignore lint/style/useNamingConvention: api schema
    conversations_column: config.conversations_column?.trim(),
    // biome-ignore lint/style/useNamingConvention: api schema
    candidate_column: config.candidate_column?.trim(),
    // biome-ignore lint/style/useNamingConvention: api schema
    approval_column:
      expressionType === "repair_merge"
        ? config.approval_column?.trim()
        : undefined,
  };
}
