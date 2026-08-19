// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export const DEFAULT_INTERNAL_THOUGHT_TAG = "Internal-Thoughts";

export function internalThoughtOpen(tag: string): string {
  return `<${tag.trim() || DEFAULT_INTERNAL_THOUGHT_TAG}>`;
}

export function internalThoughtClose(tag: string): string {
  return `</${tag.trim() || DEFAULT_INTERNAL_THOUGHT_TAG}>`;
}

export function internalThoughtRequirement(
  tag: string,
  mode: "guard" | "rewrite",
): string {
  const name = tag.trim();
  if (!name) {
    return "";
  }
  const open = `<${name}>`;
  const close = `</${name}>`;
  if (mode === "guard") {
    return ` When a source assistant or model turn contains a ${open} block, require the rewrite to preserve a valid closed ${open}...${close} block and a non-empty visible answer outside it. Reject unmatched or incomplete internal-thought tags and reasoning-only content.`;
  }
  return ` When the source response contains a ${open} block, preserve a valid closed ${open}...${close} block and include a non-empty visible answer outside it. Never return unmatched or incomplete internal-thought tags or reasoning-only content.`;
}

export function renamedPromptTokens(
  prompt: string,
  systemPrompt: string,
  fromTag: string,
  toTag: string,
): { prompt: string; system_prompt: string } | null {
  const from = fromTag.trim();
  const to = toTag.trim();
  if (!from || !to || from === to) {
    return null;
  }
  const rename = (text: string): string =>
    text
      .split(`</${from}`)
      .join(`</${to}`)
      .split(`<${from}`)
      .join(`<${to}`);
  return {
    prompt: rename(prompt),
    system_prompt: rename(systemPrompt),
  };
}