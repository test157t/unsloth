import assert from "node:assert/strict";
import test from "node:test";
import { registerStoreStubResolver } from "./helpers/kit.ts";

registerStoreStubResolver();
const { useTrainingConfigStore } = await import("../src/features/training/stores/training-config-store.ts");
const { buildTrainingStartPayload } = await import("../src/features/training/api/mappers.ts");
const { serializeConfigToYaml, parseYamlConfig } = await import("../src/features/training/lib/yaml-config.ts");
const { mapBackendModelConfigToTrainingPatch } = await import("../src/features/training/lib/model-defaults.ts");
const { partializeTrainingConfig, mergeTrainingConfig } = await import("../src/features/training/stores/training-config-persistence.ts");

test("logging interval survives request, saved settings, and YAML round trip", () => {
  const initial = useTrainingConfigStore.getState();
  assert.equal(initial.loggingSteps, 1);
  initial.setLoggingSteps(25);
  const state = useTrainingConfigStore.getState();
  assert.equal(buildTrainingStartPayload(state, null).logging_steps, 25);
  const saved = partializeTrainingConfig(state);
  assert.equal(mergeTrainingConfig(saved, initial).loggingSteps, 25);
  const imported = mapBackendModelConfigToTrainingPatch(parseYamlConfig(serializeConfigToYaml(state)));
  assert.equal(imported.loggingSteps, 25);
  state.setLoggingSteps(0);
  assert.equal(useTrainingConfigStore.getState().loggingSteps, 25);
});
