// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { ExpressionConfig } from "../../../types";
import { readBoolean, readString } from "../helpers";

export function parseRepairWorkflow(
  column: Record<string, unknown>,
  name: string,
  id: string,
  expressionType:
    | "conversation_pair"
    | "conversation_extend"
    | "agent_conversation"
    | "agent_conversation_strip_reasoning"
    | "agent_conversation_extend"
    | "agent_conversation_project"
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
    trace_column: readString(column.trace_column) ?? "",
    messages_column: readString(column.messages_column) ?? "",
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
    // biome-ignore lint/style/useNamingConvention: ui schema
    internal_thought_tag: readString(column.internal_thought_tag) ?? "",
  };
}

export function parseStringReplace(
  column: Record<string, unknown>,
  name: string,
  id: string,
): ExpressionConfig {
  return {
    id,
    kind: "expression",
    name,
    drop: column.drop === true,
    expr: "",
    dtype: "str",
    // biome-ignore lint/style/useNamingConvention: ui schema
    expression_type: "string_replace",
    // biome-ignore lint/style/useNamingConvention: ui schema
    source_column: readString(column.source_column) ?? "",
    find: readString(column.find) ?? "",
    replace_with: readString(column.replace_with) ?? "",
    // biome-ignore lint/style/useNamingConvention: ui schema
    use_regex: readBoolean(column.use_regex) ?? false,
  };
}

export function parseContentHash(
  column: Record<string, unknown>,
  name: string,
  id: string,
): ExpressionConfig {
  return {
    id,
    kind: "expression",
    name,
    drop: column.drop === true,
    expr: "",
    dtype: "str",
    // biome-ignore lint/style/useNamingConvention: ui schema
    expression_type: "content_hash",
    // biome-ignore lint/style/useNamingConvention: ui schema
    source_column: readString(column.source_column) ?? "",
    hash_length:
      typeof column.hash_length === "number"
        ? String(column.hash_length)
        : "64",
  };
}

export function parseRepairPatch(
  column: Record<string, unknown>,
  name: string,
  id: string,
): ExpressionConfig {
  return {
    id,
    kind: "expression",
    name,
    drop: column.drop === true,
    expr: "",
    dtype: "str",
    // biome-ignore lint/style/useNamingConvention: ui schema
    expression_type: "repair_patch",
    // biome-ignore lint/style/useNamingConvention: ui schema
    uuid_column: readString(column.uuid_column) ?? "row_uuid",
    // biome-ignore lint/style/useNamingConvention: ui schema
    source_column: readString(column.source_column) ?? "",
    // biome-ignore lint/style/useNamingConvention: ui schema
    patch_column: readString(column.patch_column) ?? "",
    hash_length:
      typeof column.hash_length === "number"
        ? String(column.hash_length)
        : "64",
  };
}
