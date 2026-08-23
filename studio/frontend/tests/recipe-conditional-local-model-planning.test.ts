// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";
import type { RecipePayload } from "../src/features/recipe-studio/utils/payload/types.ts";
import { collectUsedLlmModelAliases } from "../src/features/recipe-studio/executions/local-model-columns.ts";

function payload(columns: Record<string, unknown>[]): RecipePayload {
  return {
    recipe: {
      model_providers: [],
      mcp_providers: [],
      model_configs: [],
      tool_configs: [],
      columns,
      processors: [],
    },
    run: { rows: 5, preview: true, output_formats: ["jsonl"] },
    ui: { nodes: [], edges: [] },
  };
}

test("conditional LLM columns participate in local model auto-loading", () => {
  const aliases = collectUsedLlmModelAliases(payload([
    {
      column_type: "unsloth-conditional-llm-structured",
      name: "rewrite_patch",
      model_alias: "model_rewriter",
    },
  ]));
  assert.deepEqual([...aliases], ["model_rewriter"]);
});

test("non-LLM custom columns do not trigger model loading", () => {
  const aliases = collectUsedLlmModelAliases(payload([
    {
      column_type: "unsloth-repair-patch",
      name: "rewrite_result",
      model_alias: "not-a-real-model-use",
    },
  ]));
  assert.deepEqual([...aliases], []);
});
