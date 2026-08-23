// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import { registerBundlerResolver } from "./helpers/kit.ts";

registerBundlerResolver();
const { buildTrainingStartPayload } = await import(
  "../src/features/training/api/mappers.ts"
);
const { serializeConfigToYaml } = await import(
  "../src/features/training/lib/yaml-config.ts"
);
const { initialTrainingConfigState } = await import(
  "../src/features/training/stores/training-config-policy.ts"
);

const base = {
  ...initialTrainingConfigState,
  modelType: "text" as const,
  selectedModel: "google/gemma-4-26B-A4B-it",
  trainingMethod: "lora" as const,
  datasetSource: "huggingface" as const,
  dataset: "example/reasoning",
  datasetFormat: "sharegpt" as const,
};

test("reasoning preservation is opt-in on the training wire payload", () => {
  assert.equal(buildTrainingStartPayload(base, null).preserve_reasoning, false);
  assert.equal(
    buildTrainingStartPayload({ ...base, preserveReasoning: true }, null).preserve_reasoning,
    true,
  );
});

test("raw training ignores reasoning preservation and YAML records the choice", () => {
  const enabled = { ...base, preserveReasoning: true };
  assert.equal(
    buildTrainingStartPayload({ ...enabled, datasetFormat: "raw" }, null).preserve_reasoning,
    false,
  );
  assert.match(serializeConfigToYaml(enabled, false), /preserve_reasoning: true/);
});
