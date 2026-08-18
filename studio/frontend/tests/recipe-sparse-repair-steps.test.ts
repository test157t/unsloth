// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("conversation extend serializes as a deterministic native step", () => {
  const config: ExpressionConfig = {
    id: "extend",
    kind: "expression",
    expression_type: "conversation_extend",
    name: "extended_conversations",
    expr: "",
    dtype: "str",
    conversations_column: "conversations",
    human_column: "human_followup",
    assistant_column: "mia_response",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "extended_conversations",
    drop: false,
    column_type: "unsloth-conversation-extend",
    conversations_column: "conversations",
    human_column: "human_followup",
    assistant_column: "mia_response",
  });
});

test("default repair and guard contracts lock scope and internal thoughts", () => {
  const factoriesSource = readFileSync(
    new URL(
      "../src/features/recipe-studio/utils/config-factories.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal(
    factoriesSource.match(/non-empty visible answer/g)?.length,
    2,
  );
  assert.equal(
    factoriesSource.match(/incomplete internal-thought tags/g)?.length,
    2,
  );
  assert.equal(factoriesSource.match(/reasoning-only content/g)?.length, 2);
  assert.match(
    factoriesSource,
    /<Mia_Internal-Thoughts>\.\.\.<\/Mia_Internal-Thoughts>/,
  );
  assert.equal(
    factoriesSource.match(/dataset content/g)?.length,
    2,
  );
  assert.equal(
    factoriesSource.match(/Do not invent or independently apply safety/g)
      ?.length,
    2,
  );
  assert.match(
    factoriesSource,
    /never reject a candidate merely because it directly complies/,
  );
  assert.match(
    factoriesSource,
    /a non-refusal regression means the candidate became more refusing/,
  );
  assert.match(factoriesSource, /core safety layer/);
  assert.match(
    factoriesSource,
    /identify the exact supplied repair task that remains unfixed/,
  );
  assert.match(factoriesSource, /uncited refusal or sanitization/);
});
