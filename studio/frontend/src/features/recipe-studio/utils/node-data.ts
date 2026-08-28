// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { LayoutDirection, NodeConfig, RecipeNodeData } from "../types";
import {
  labelForExpression,
  labelForLlm,
  labelForSampler,
} from "./config-labels";

export function nodeDataFromConfig(
  config: NodeConfig,
  layoutDirection: LayoutDirection = "LR",
): RecipeNodeData {
  if (config.kind === "sampler") {
    return {
      title: "Generated field",
      kind: "sampler",
      subtype: labelForSampler(config.sampler_type),
      blockType: config.sampler_type,
      name: config.name,
      layoutDirection,
    };
  }
  if (config.kind === "expression") {
    const workflowType = config.expression_type ?? "formula";
    if (workflowType !== "formula") {
      const labels = {
        string_replace: ["String replace", "Deterministic"],
        content_hash: ["Content hash", "sha256"],
        repair_patch: ["Repair patch", "Hash-guided"],
        conversation_pair: ["Conversation pair", "Fixed human then gpt"],
        conversation_extend: ["Conversation extend", "Append human/gpt"],
        agent_conversation: ["Agent conversation", "Preserve tool trace"],
        agent_conversation_strip_reasoning: [
          "Agent reasoning strip",
          "Visible history only",
        ],
        agent_conversation_extend: ["Agent extension", "Append tool trace"],
        agent_conversation_project: ["Agent projection", "User/final assistant"],
        repair_tasks: ["Repair tasks", "Failed criteria"],
        repair_check: ["Repair check", "Deterministic"],
        repair_merge: ["Repair merge", "Approved only"],
        jsonl_export: ["JSONL output", "Downloadable artifact"],
      } as const;
      const [title, subtype] = labels[workflowType];
      return {
        title,
        kind: "expression",
        subtype,
        blockType: workflowType,
        name: config.name,
        layoutDirection,
      };
    }
    return {
      title: "Formula",
      kind: "expression",
      subtype: labelForExpression(config.dtype),
      blockType: "expression",
      name: config.name,
      layoutDirection,
    };
  }
  if (config.kind === "validator") {
    const isOxc = config.validator_type === "oxc";
    const isSql = config.code_lang.startsWith("sql:");
    let subtype = "Python";
    let blockType: RecipeNodeData["blockType"] = "validator_python";
    if (isOxc) {
      subtype = "OXC";
      blockType = "validator_oxc";
    } else if (isSql) {
      subtype = "SQL";
      blockType = "validator_sql";
    }
    return {
      title: "Check",
      kind: "validator",
      subtype,
      blockType,
      name: config.name,
      layoutDirection,
    };
  }
  if (config.kind === "markdown_note") {
    return {
      title: "Note",
      kind: "note",
      subtype: "Markdown",
      blockType: "markdown_note",
      name: config.name,
      layoutDirection,
    };
  }
  if (config.kind === "seed") {
    const seedSourceType = config.seed_source_type ?? "hf";
    const sourceLabel =
      seedSourceType === "hf"
        ? "Hugging Face dataset"
        : seedSourceType === "local"
          ? "CSV or JSON file"
          : seedSourceType === "github_repo"
            ? "GitHub repositories"
            : "Document file";
    return {
      title: "Source data",
      kind: "seed",
      subtype: sourceLabel,
      blockType: "seed",
      name: sourceLabel,
      layoutDirection,
    };
  }
  if (config.kind === "model_provider") {
    return {
      title: "Provider connection",
      kind: "model_provider",
      subtype: config.provider_type || "Connection",
      blockType: "model_provider",
      name: config.name,
      layoutDirection,
    };
  }
  if (config.kind === "model_config") {
    return {
      title: "Model preset",
      kind: "model_config",
      subtype: config.model || "Model",
      blockType: "model_config",
      name: config.name,
      layoutDirection,
    };
  }
  if (config.kind === "tool_config") {
    const providerCount = config.mcp_providers.length;
    return {
      title: "Tool access",
      kind: "tool_config",
      subtype: providerCount === 1 ? "1 server" : `${providerCount} servers`,
      blockType: "tool_config",
      name: config.name,
      layoutDirection,
    };
  }
  return {
    title: config.run_if?.trim() ? "Conditional AI" : "AI step",
    kind: "llm",
    subtype: labelForLlm(config.llm_type),
    blockType: config.run_if?.trim() ? "conditional_ai" : config.llm_type,
    name: config.name,
    layoutDirection,
  };
}
