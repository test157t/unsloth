// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import { parseTrainingTranscript } from "../src/features/studio/sections/training-entry-transcript.ts";

test("parses Gemma turns into chat messages", () => {
  assert.deepEqual(
    parseTrainingTranscript(
      "<bos><start_of_turn>user\nHello<end_of_turn><start_of_turn>model\nHi there<end_of_turn>",
    ),
    [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
  );
});

test("keeps Gemma 4 reasoning separate from the final answer", () => {
  assert.deepEqual(
    parseTrainingTranscript(
      "<|turn>user\nWhy?<turn|>\n<|turn>model\n<|channel>thought\nBecause of evidence.<channel|>The answer.<turn|>",
    ),
    [
      { role: "user", content: "Why?" },
      {
        role: "assistant",
        reasoning: "Because of evidence.",
        content: "The answer.",
      },
    ],
  );
});

test("hides Gemma thinking activation without hiding a real system prompt", () => {
  assert.deepEqual(
    parseTrainingTranscript(
      "<|turn>system\n<|think|>\n<turn|><|turn>user\nQuestion<turn|>",
    ),
    [{ role: "user", content: "Question" }],
  );
  assert.deepEqual(
    parseTrainingTranscript(
      "<|turn>system\n<|think|>\nFollow these rules.<turn|>",
    ),
    [{ role: "system", content: "Follow these rules." }],
  );
});

test("parses ChatML and Llama role markers", () => {
  assert.deepEqual(
    parseTrainingTranscript("<|im_start|>system\nRules<|im_end|><|im_start|>user\nGo<|im_end|>"),
    [
      { role: "system", content: "Rules" },
      { role: "user", content: "Go" },
    ],
  );
  assert.deepEqual(
    parseTrainingTranscript(
      "<|start_header_id|>assistant<|end_header_id|>\n\nAnswer<|eot_id|>",
    ),
    [{ role: "assistant", content: "Answer" }],
  );
});
