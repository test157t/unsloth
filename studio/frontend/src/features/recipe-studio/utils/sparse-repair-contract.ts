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
  if (expressionType === "string_replace") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-string-replace",
      // biome-ignore lint/style/useNamingConvention: api schema
      source_column: config.source_column?.trim(),
      find: config.find ?? "",
      replace_with: config.replace_with ?? "",
      // biome-ignore lint/style/useNamingConvention: api schema
      use_regex: Boolean(config.use_regex),
    };
  }
  if (expressionType === "content_hash") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-content-hash",
      // biome-ignore lint/style/useNamingConvention: api schema
      source_column: config.source_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      hash_length: Number(config.hash_length ?? "64"),
    };
  }
  if (expressionType === "repair_patch") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-repair-patch",
      // biome-ignore lint/style/useNamingConvention: api schema
      uuid_column: config.uuid_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      source_column: config.source_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      patch_column: config.patch_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      hash_length: Number(config.hash_length ?? "64"),
    };
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
  if (expressionType === "agent_conversation") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-agent-conversation",
      // biome-ignore lint/style/useNamingConvention: api schema
      human_column: config.human_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      trace_column: config.trace_column?.trim(),
    };
  }
  if (expressionType === "agent_conversation_extend") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-agent-conversation-extend",
      // biome-ignore lint/style/useNamingConvention: api schema
      messages_column: config.messages_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      human_column: config.human_column?.trim(),
      // biome-ignore lint/style/useNamingConvention: api schema
      trace_column: config.trace_column?.trim(),
    };
  }
  if (expressionType === "agent_conversation_project") {
    return {
      name: config.name,
      drop: config.drop ?? false,
      // biome-ignore lint/style/useNamingConvention: api schema
      column_type: "unsloth-agent-conversation-project",
      // biome-ignore lint/style/useNamingConvention: api schema
      messages_column: config.messages_column?.trim(),
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
    // biome-ignore lint/style/useNamingConvention: api schema
    internal_thought_tag: config.internal_thought_tag?.trim() || undefined,
  };
}
