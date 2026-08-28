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
    assistant_column: "assistant_response",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "conversations",
    drop: false,
    column_type: "unsloth-conversation-pair",
    human_column: "human_message",
    assistant_column: "assistant_response",
  });
});

test("conversation and agent assembly serialize an opted-in reasoning tag", () => {
  const base = {
    kind: "expression" as const,
    expr: "",
    dtype: "str" as const,
    internal_thought_tag: "Mia_Internal-Thoughts",
  };
  assert.equal(
    buildSparseRepairColumn({
      ...base,
      id: "pair-tagged",
      expression_type: "conversation_pair",
      name: "conversations",
      human_column: "human_message",
      assistant_column: "mia_response",
    })?.internal_thought_tag,
    "Mia_Internal-Thoughts",
  );
  assert.equal(
    buildSparseRepairColumn({
      ...base,
      id: "agent-tagged",
      expression_type: "agent_conversation",
      name: "agent_messages",
      human_column: "human_message",
      trace_column: "mia_response__trace",
    })?.internal_thought_tag,
    "Mia_Internal-Thoughts",
  );
  assert.equal(
    buildSparseRepairColumn({
      ...base,
      id: "agent-extend-tagged",
      expression_type: "agent_conversation_extend",
      name: "agent_messages",
      messages_column: "messages_clean",
      human_column: "human_followup",
      trace_column: "mia_response__trace",
    })?.internal_thought_tag,
    "Mia_Internal-Thoughts",
  );
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
    assistant_column: "assistant_response",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "extended_conversations",
    drop: false,
    column_type: "unsloth-conversation-extend",
    conversations_column: "conversations",
    human_column: "human_followup",
    assistant_column: "assistant_response",
  });
});

test("agent conversation serializes a natural user turn plus the LLM trace", () => {
  const config: ExpressionConfig = {
    id: "agent",
    kind: "expression",
    expression_type: "agent_conversation",
    name: "agent_messages",
    expr: "",
    dtype: "str",
    human_column: "human_message",
    trace_column: "mia_response__trace",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "agent_messages",
    drop: false,
    column_type: "unsloth-agent-conversation",
    human_column: "human_message",
    trace_column: "mia_response__trace",
  });
});

test("agent conversation extension serializes persistent history and a new trace", () => {
  const config: ExpressionConfig = {
    id: "agent-extend",
    kind: "expression",
    expression_type: "agent_conversation_extend",
    name: "agent_messages",
    expr: "",
    dtype: "str",
    messages_column: "messages",
    human_column: "human_followup",
    trace_column: "mia_response__trace",
  };
  assert.deepEqual(buildSparseRepairColumn(config), {
    name: "agent_messages",
    drop: false,
    column_type: "unsloth-agent-conversation-extend",
    messages_column: "messages",
    human_column: "human_followup",
    trace_column: "mia_response__trace",
  });
});

test("agent reasoning strip serializes an ordinary-conversation fallback", () => {
  const config: ExpressionConfig = {
    id: "strip-history",
    kind: "expression",
    expression_type: "agent_conversation_strip_reasoning",
    name: "messages_clean",
    expr: "",
    dtype: "str",
    messages_column: "messages",
    conversations_column: "conversations",
    internal_thought_tag: "Mia_Internal-Thoughts",
  };
  assert.deepEqual(buildSparseRepairColumn(config), {
    name: "messages_clean",
    drop: false,
    column_type: "unsloth-agent-conversation-strip-reasoning",
    messages_column: "messages",
    conversations_column: "conversations",
    internal_thought_tag: "Mia_Internal-Thoughts",
  });
});

test("agent conversation projection serializes a ShareGPT compatibility view", () => {
  const config: ExpressionConfig = {
    id: "agent-project",
    kind: "expression",
    expression_type: "agent_conversation_project",
    name: "extended_conversations",
    expr: "",
    dtype: "str",
    messages_column: "agent_messages",
  };
  assert.deepEqual(buildSparseRepairColumn(config), {
    name: "extended_conversations",
    drop: false,
    column_type: "unsloth-agent-conversation-project",
    messages_column: "agent_messages",
  });
});

test("string replace serializes as a deterministic native step", () => {
  const config: ExpressionConfig = {
    id: "clean",
    kind: "expression",
    expression_type: "string_replace",
    name: "cleaned",
    expr: "",
    dtype: "str",
    source_column: "assistant_response",
    find: "\\n\\n",
    replace_with: "\\n",
    use_regex: true,
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "cleaned",
    drop: false,
    column_type: "unsloth-string-replace",
    source_column: "assistant_response",
    find: "\\n\\n",
    replace_with: "\\n",
    use_regex: true,
  });
});

test("string replace defaults regex to false", () => {
  const config: ExpressionConfig = {
    id: "fix",
    kind: "expression",
    expression_type: "string_replace",
    name: "fixed",
    expr: "",
    dtype: "str",
    source_column: "text",
    find: "  ",
    replace_with: " ",
  };
  const payload = buildSparseRepairColumn(config);
  assert.ok(payload);
  assert.equal(payload.use_regex, false);
});

test("content hash serializes as a deterministic hash column", () => {
  const config: ExpressionConfig = {
    id: "hash",
    kind: "expression",
    expression_type: "content_hash",
    name: "cell_hash",
    expr: "",
    dtype: "str",
    source_column: "assistant_response",
    hash_length: "64",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "cell_hash",
    drop: false,
    column_type: "unsloth-content-hash",
    source_column: "assistant_response",
    hash_length: 64,
  });
});

test("content hash round-trips through the import parser", () => {
  const parserSource = readFileSync(
    new URL(
      "../src/features/recipe-studio/utils/import/parsers/repair-workflow-parser.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    parserSource,
    /export function parseContentHash[\s\S]*?expression_type: "content_hash"[\s\S]*?hash_length:/,
  );
  assert.match(
    parserSource,
    /export function parseRepairPatch[\s\S]*?patch_column: readString\(column.patch_column\)/,
  );
});

test("repair patch serializes as a hash-aware patch column", () => {
  const config: ExpressionConfig = {
    id: "patch",
    kind: "expression",
    expression_type: "repair_patch",
    name: "apply_patch",
    expr: "",
    dtype: "str",
    uuid_column: "row_uuid",
    source_column: "rewrite_result",
    patch_column: "candidate_patch",
    hash_length: "64",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "apply_patch",
    drop: false,
    column_type: "unsloth-repair-patch",
    uuid_column: "row_uuid",
    source_column: "rewrite_result",
    patch_column: "candidate_patch",
    hash_length: 64,
  });
});

test("repair patch round-trips through the import parser", () => {
  const parserSource = readFileSync(
    new URL(
      "../src/features/recipe-studio/utils/import/parsers/repair-workflow-parser.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    parserSource,
    /expression_type: "repair_patch"[\s\S]*?uuid_column: readString\(column.uuid_column\)/,
  );
  assert.match(parserSource, /hash_length:/);
});

test("repair check serializes the configured reasoning tag", () => {
  const config: ExpressionConfig = {
    id: "check",
    kind: "expression",
    expression_type: "repair_check",
    name: "repair_check",
    expr: "",
    dtype: "str",
    uuid_column: "row_uuid",
    conversations_column: "conversations",
    candidate_column: "rewrite_result",
    internal_thought_tag: "Hidden-Reasoning",
  };
  const payload = buildSparseRepairColumn(config);
  assert.deepEqual(payload, {
    name: "repair_check",
    drop: false,
    column_type: "unsloth-repair-check",
    uuid_column: "row_uuid",
    conversations_column: "conversations",
    candidate_column: "rewrite_result",
    approval_column: undefined,
    internal_thought_tag: "Hidden-Reasoning",
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
  const reasoningSource = readFileSync(
    new URL(
      "../src/features/recipe-studio/utils/repair-reasoning.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal(reasoningSource.match(/non-empty visible answer/g)?.length, 2);
  assert.equal(
    reasoningSource.match(/incomplete internal-thought tags/g)?.length,
    2,
  );
  assert.equal(reasoningSource.match(/reasoning-only content/g)?.length, 2);
  assert.match(reasoningSource, /Internal-Thoughts/);
  assert.match(reasoningSource, /\.\.\.\$\{close\}/);
  assert.match(reasoningSource, /\$\{open\}/);
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
