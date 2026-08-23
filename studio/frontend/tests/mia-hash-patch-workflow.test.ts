// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { registerBundlerResolver } from "./helpers/kit.ts";

registerBundlerResolver();
const { importRecipePayload } = await import(
  "../src/features/recipe-studio/utils/import/importer.ts"
);

function workflowText(name: string): string {
  return readFileSync(new URL(`../../../Mia_Workflows/${name}`, import.meta.url), "utf8");
}

function modelInferenceParameters(name: string): Record<string, unknown> {
  const payload = JSON.parse(workflowText(name)) as {
    recipe: {
      model_configs: Array<{ inference_parameters: Record<string, unknown> }>;
    };
  };
  return payload.recipe.model_configs[0]?.inference_parameters ?? {};
}

test("Mia local workflows use context-safe inference budgets", () => {
  assert.deepEqual(
    ["Mia_2_Judge.json", "Mia_3_Rewrite.json", "Mia_4_Guard_Select.json"].map(
      (name) => modelInferenceParameters(name).max_parallel_requests,
    ),
    [1, 1, 1],
  );
  assert.deepEqual(
    ["Mia_2_Judge.json", "Mia_3_Rewrite.json", "Mia_4_Guard_Select.json"].map(
      (name) => modelInferenceParameters(name).max_tokens,
    ),
    [1024, 2048, 1024],
  );
});

test("Mia rewrite imports as a hash-addressed patch workflow", () => {
  const result = importRecipePayload(workflowText("Mia_3_Rewrite.json"));
  assert.deepEqual(result.errors, []);
  assert.ok(result.snapshot);
  const configs = new Map(
    Object.values(result.snapshot.configs).map((config) => [config.name, config]),
  );
  assert.equal(configs.get("assistant_response")?.kind, "expression");
  assert.equal(configs.get("assistant_hash")?.kind, "expression");
  assert.equal(configs.get("rewrite_patch")?.kind, "llm");
  assert.equal(configs.get("rewrite_result")?.kind, "expression");
});

test("Mia guard consumes the deterministic patch candidate contract", () => {
  const payload = JSON.parse(workflowText("Mia_4_Guard_Select.json")) as {
    recipe: { columns: Array<Record<string, unknown>> };
  };
  const guard = payload.recipe.columns.find((column) => column.name === "rewrite_guard");
  assert.equal(typeof guard?.prompt, "string");
  assert.match(String(guard?.prompt), /rewrite_result\.response/);
  assert.doesNotMatch(String(guard?.prompt), /rewrite_result\.conversations/);
});
