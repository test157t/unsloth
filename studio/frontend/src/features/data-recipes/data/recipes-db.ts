// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { createEmptyRecipePayload } from "@/features/recipe-studio";
import { accountDatabaseName } from "@/lib/account-transition";
import { normalizeNonEmptyName } from "@/utils";
import Dexie from "dexie";
import { authFetch } from "@/features/auth/api";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import type { RecipeRecord, SaveRecipeInput } from "../types";

// IndexedDB is read only for migration. All ongoing CRUD uses the account's server store.
const listeners = new Set<() => void>();
const recentRecipeCache = new Map<string, RecipeRecord>();
let cachedRecipeList: RecipeRecord[] = [];
let migration: Promise<void> | null = null;
let migrationWarningShown = false;

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/data-recipe/saved${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `Recipe request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

async function migrateBrowserRecipes(): Promise<void> {
  if (migration) return migration;
  migration = (async () => {
    const name = accountDatabaseName("unsloth-data-recipes");
    if (!(await Dexie.exists(name))) return;
    const legacy = new Dexie(name);
    try {
      await legacy.open();
      const records = await legacy.table("recipes").toArray();
      // Import in bounded batches; server receipts make retries idempotent.
      for (let offset = 0; offset < records.length; offset += 25) {
        await request("/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(records.slice(offset, offset + 25)),
        });
      }
    } finally { legacy.close(); }
  })().catch((error: unknown) => {
    migration = null;
    // Browser storage is only a recovery source; its unavailability must not
    // prevent using the canonical server store.
    if (!migrationWarningShown) {
      migrationWarningShown = true;
      toast.error(`Existing browser recipes could not be imported; their local copies are unchanged. ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return migration;
}

export async function listRecipes(): Promise<RecipeRecord[]> {
  await migrateBrowserRecipes();
  const records = await request<RecipeRecord[]>();
  cachedRecipeList = records;
  recentRecipeCache.clear();
  records.forEach((record) => recentRecipeCache.set(record.id, record));
  return records;
}

export function preloadRecipes(): Promise<RecipeRecord[]> { return listRecipes(); }

export async function getRecipe(id: string): Promise<RecipeRecord | undefined> {
  await migrateBrowserRecipes();
  const response = await authFetch(`/api/data-recipe/saved/${encodeURIComponent(id)}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Could not load recipe (${response.status}).`);
  return response.json();
}

export function getCachedRecipe(id: string): RecipeRecord | null {
  return recentRecipeCache.get(id) ?? null;
}

export function primeRecipeCache(record: RecipeRecord): void {
  recentRecipeCache.set(record.id, record);
}

export async function saveRecipe(input: SaveRecipeInput): Promise<RecipeRecord> {
  await migrateBrowserRecipes();
  const record = await request<RecipeRecord>("", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, name: normalizeNonEmptyName(input.name) }),
  });
  primeRecipeCache(record);
  listeners.forEach((notify) => notify());
  return record;
}

export async function deleteRecipe(id: string): Promise<void> {
  await migrateBrowserRecipes();
  await request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  recentRecipeCache.delete(id);
  listeners.forEach((notify) => notify());
}
export function createRecipeDraft(): Promise<RecipeRecord> {
  return saveRecipe({
    name: "Unnamed",
    payload: createEmptyRecipePayload(),
  });
}

export function createRecipeFromLearningRecipe(input: {
  templateId: string;
  templateTitle: string;
  payload: RecipeRecord["payload"];
}): Promise<RecipeRecord> {
  return saveRecipe({
    name: input.templateTitle,
    payload: input.payload,
    learningRecipeId: input.templateId,
    learningRecipeTitle: input.templateTitle,
  });
}

export function useRecipes(): { recipes: RecipeRecord[]; ready: boolean; error: string | null } {
  const [recipes, setRecipes] = useState<RecipeRecord[]>(cachedRecipeList);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      const current = ++revision;
      void listRecipes().then((records) => {
        if (active && current === revision) { setRecipes(records); setError(null); setReady(true); }
      }).catch((reason: unknown) => {
        if (active && current === revision) {
          setError(reason instanceof Error ? reason.message : "Could not load saved recipes.");
          setReady(true);
        }
      });
    };
    listeners.add(refresh);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 15000);
    refresh();
    return () => { active = false; listeners.delete(refresh); window.removeEventListener("focus", refresh); window.clearInterval(interval); };
  }, []);
  return { recipes, ready, error };
}
