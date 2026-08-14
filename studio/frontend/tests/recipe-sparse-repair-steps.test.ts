// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";
import type {
  ExpressionConfig,
  LlmConfig,
} from "../src/features/recipe-studio/types/index.ts";
import {
  buildSparseRepairColumn,
  conditionalLlmColumnType,
} from "../src/features/recipe-studio/utils/sparse-repair-contract.ts";

test("conditional structured AI serializes a real conditional column", () => {
  const config: LlmConfig = {
    id: "conditional",
    kind: "llm",
    llm_type: "structured",
    name: "rewrite_result",
    model_alias: "repairer",
    prompt: "{{ repair_tasks }}",
    system_prompt: "",
    output_format: '{"type":"object"}',
    run_if: "{{ repair_tasks.repairs | length > 0 }}",
  };
  assert.equal(
    conditionalLlmColumnType(config.llm_type),
    "unsloth-conditional-llm-structured",
  );
});

test("repair helpers serialize and import without becoming formulas", () => {
  const config: ExpressionConfig = {
    id: "tasks",
    kind: "expression",
    expression_type: "repair_tasks",
    name: "repair_tasks",
    expr: "",
    dtype: "str",
    uuid_column: "row_uuid",
    judge_column: "judge",
    threshold: "4",
  };
  const payload = buildSparseRepairColumn(config);
  assert.ok(payload);
  assert.equal(payload.column_type, "unsloth-repair-tasks");
  assert.equal(payload.judge_column, "judge");
  assert.equal(payload.threshold, 4);
});

test("conversation pair serializes as a deterministic native step", () => {
  const config: ExpressionConfig = {
    id: "pair",
    kind: "expression",
    expression_type: "conversation_pair",
    name: "conversations",
    expr: "",
    dtype: "str",
    human_column: "human_message",
    assistant_column: "mia_response",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "conversations",
    drop: false,
    column_type: "unsloth-conversation-pair",
    human_column: "human_message",
    assistant_column: "mia_response",
  });
});
