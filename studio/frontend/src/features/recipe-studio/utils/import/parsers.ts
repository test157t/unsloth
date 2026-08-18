// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { NodeConfig } from "../../types";
import { readString } from "./helpers";
import { parseExpression } from "./parsers/expression-parser";
import { parseLlm } from "./parsers/llm-parser";
export { parseModelConfig, parseModelProvider } from "./parsers/model-parser";
import { parseRepairWorkflow } from "./parsers/repair-workflow-parser";
import { parseSampler } from "./parsers/sampler-parser";
import { parseValidator } from "./parsers/validator-parser";

type ColumnParser = (
  column: Record<string, unknown>,
  name: string,
  id: string,
  errors: string[],
) => NodeConfig | null;

const COLUMN_PARSERS: Record<string, ColumnParser> = {
  sampler: (column, name, id, errors) => parseSampler(column, name, id, errors),
  expression: (column, name, id) => parseExpression(column, name, id),
  "llm-text": (column, name, id) => parseLlm(column, name, id),
  "llm-structured": (column, name, id) => parseLlm(column, name, id),
  "llm-code": (column, name, id) => parseLlm(column, name, id),
  "llm-judge": (column, name, id) => parseLlm(column, name, id),
  "unsloth-conditional-llm-text": (column, name, id) =>
    parseLlm(column, name, id),
  "unsloth-conditional-llm-structured": (column, name, id) =>
    parseLlm(column, name, id),
  "unsloth-conditional-llm-code": (column, name, id) =>
    parseLlm(column, name, id),
  "unsloth-conditional-llm-judge": (column, name, id) =>
    parseLlm(column, name, id),
  "unsloth-conversation-pair": (column, name, id) =>
    parseRepairWorkflow(column, name, id, "conversation_pair"),
  "unsloth-conversation-extend": (column, name, id) =>
    parseRepairWorkflow(column, name, id, "conversation_extend"),
  "unsloth-repair-tasks": (column, name, id) =>
    parseRepairWorkflow(column, name, id, "repair_tasks"),
  "unsloth-repair-check": (column, name, id) =>
    parseRepairWorkflow(column, name, id, "repair_check"),
  "unsloth-repair-merge": (column, name, id) =>
    parseRepairWorkflow(column, name, id, "repair_merge"),
  validation: (column, name, id) => parseValidator(column, name, id),
};

export function parseColumn(
  column: Record<string, unknown>,
  id: string,
  errors: string[],
): NodeConfig | null {
  const name = readString(column.name);
  if (!name) {
    errors.push("Column missing name.");
    return null;
  }
  const columnType = readString(column.column_type);
  const parser = columnType ? COLUMN_PARSERS[columnType] : null;
  if (parser) {
    return parser(column, name, id, errors);
  }
  errors.push(`Column ${name}: unsupported column_type.`);
  return null;
}
