// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import Dexie, { type EntityTable } from "dexie";
import type { RecipeExecutionRecord } from "../execution-types";

const db = new Dexie("unsloth-data-recipe-executions") as Dexie & {
  executions: EntityTable<RecipeExecutionRecord, "id">;
  deletedExecutions: EntityTable<{ id: string }, "id">;
};

db.version(1).stores({
  executions: "id, recipeId, kind, status, createdAt",
});

db.version(2).stores({
  executions: "id, recipeId, kind, status, createdAt, finishedAt, jobId",
});

db.version(3).stores({
  executions: "id, recipeId, kind, status, createdAt, finishedAt, jobId",
  deletedExecutions: "id",
});

export async function listRecipeExecutions(
  recipeId: string,
): Promise<RecipeExecutionRecord[]> {
  const executions = await db.executions.where("recipeId").equals(recipeId).toArray();
  return executions.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveRecipeExecution(
  execution: RecipeExecutionRecord,
): Promise<void> {
  await db.transaction("rw", db.executions, db.deletedExecutions, async () => {
    if (!(await db.deletedExecutions.get(execution.id))) {
      await db.executions.put(execution);
    }
  });
}

export async function deleteRecipeExecution(id: string): Promise<void> {
  await db.transaction("rw", db.executions, db.deletedExecutions, async () => {
    await db.deletedExecutions.put({ id });
    await db.executions.delete(id);
  });
}
