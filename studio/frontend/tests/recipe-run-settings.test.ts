// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";
import { registerBundlerResolver } from "./helpers/kit.ts";

registerBundlerResolver();
const { useRecipeExecutionsStore } = await import(
  "../src/features/recipe-studio/stores/recipe-executions.ts"
);

test("recipe runs stop early on systemic errors by default", () => {
  const settings = useRecipeExecutionsStore.getState().runSettings;
  assert.equal(settings.disableEarlyShutdown, false);
  assert.equal(settings.shutdownErrorRate, 0.5);
  assert.equal(settings.shutdownErrorWindow, 10);
});
