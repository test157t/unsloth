// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { RecipePayload } from "../utils/payload/types";

export function collectUsedLlmModelAliases(payload: RecipePayload): Set<string> {
  const columns = Array.isArray(payload.recipe.columns)
    ? payload.recipe.columns
    : [];
  const aliases = new Set<string>();
  for (const column of columns) {
    const columnType = column.column_type;
    if (
      typeof columnType !== "string" ||
      (!columnType.startsWith("llm-") &&
        !columnType.startsWith("unsloth-conditional-llm-"))
    ) {
      continue;
    }
    const alias = column.model_alias;
    if (typeof alias === "string" && alias.trim()) {
      aliases.add(alias.trim());
    }
  }
  return aliases;
}
