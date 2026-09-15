import assert from "node:assert/strict";
import test from "node:test";
import { externalSamplingParams } from "../src/features/chat/external-sampling.ts";
import { DEFAULT_INFERENCE_PARAMS } from "../src/features/chat/types/runtime.ts";

const all = { temperature: true, topP: true, topK: true, minP: true,
  repetitionPenalty: true, presencePenalty: true };

test("Off samplers are omitted, while zero temperature remains a real setting", () => {
  const body = externalSamplingParams({ ...DEFAULT_INFERENCE_PARAMS, temperature: 0,
    topP: 1, topK: 0, minP: 0, repetitionPenalty: 1, presencePenalty: 0 }, all);
  assert.deepEqual(body, { temperature: 0 });
});

test("enabled samplers keep their values and unsupported controls stay absent", () => {
  const params = { ...DEFAULT_INFERENCE_PARAMS, temperature: 0.4, topP: 0.8,
    topK: 15, minP: 0.04, repetitionPenalty: 1.2, presencePenalty: 0.3 };
  assert.deepEqual(externalSamplingParams(params, all), { temperature: 0.4, top_p: 0.8,
    top_k: 15, min_p: 0.04, repetition_penalty: 1.2, presence_penalty: 0.3 });
  assert.deepEqual(externalSamplingParams(params, { temperature: false, topP: false,
    topK: false, minP: false, repetitionPenalty: false, presencePenalty: false }), {});
});
