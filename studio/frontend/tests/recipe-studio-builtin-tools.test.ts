// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isProviderReadyForToolFetch,
  toApiProvider,
} from "../src/features/recipe-studio/dialogs/tool-profile/helpers.ts";
import type { LlmMcpProviderConfig } from "../src/features/recipe-studio/types/index.ts";

const builtins: LlmMcpProviderConfig = {
  id: "provider-1",
  name: "studio",
  provider_type: "studio_builtin",
};

test("Studio built-ins serialize without a user command or endpoint", () => {
  const source = readFileSync(
    new URL(
      "../src/features/recipe-studio/utils/payload/builders-llm.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /provider\.provider_type === "studio_builtin"/);
  assert.match(source, /provider_type: "studio_builtin"/);
});

test("Studio built-ins are ready for discovery with the same API shape", () => {
  assert.equal(isProviderReadyForToolFetch(builtins), true);
  assert.deepEqual(toApiProvider(builtins), {
    provider_type: "studio_builtin",
    name: "studio",
  });
});
