// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import {
  BalanceScaleIcon,
  Clock01Icon,
  CodeIcon,
  CodeSimpleIcon,
  DiceFaces03Icon,
  DocumentAttachmentIcon,
  DocumentCodeIcon,
  EqualSignIcon,
  FingerPrintIcon,
  FunctionIcon,
  GithubIcon,
  Parabola02Icon,
  PencilEdit02Icon,
  Plant01Icon,
  Plug01Icon,
  Shield02Icon,
  Tag01Icon,
  TagsIcon,
  UserAccountIcon,
} from "@hugeicons/core-free-icons";
import type {
  LlmType,
  NodeConfig,
  SamplerType,
  SeedSourceType,
} from "../types";
import {
  makeConditionalRepairLlmConfig,
  makeContentHashConfig,
  makeExpressionConfig,
  makeJsonlExportConfig,
  makeLlmConfig,
  makeMarkdownNoteConfig,
  makeModelConfig,
  makeModelProviderConfig,
  makeRepairPatchConfig,
  makeRepairWorkflowConfig,
  makeSamplerConfig,
  makeSeedConfig,
  makeStringReplaceConfig,
  makeToolProfileConfig,
  makeValidatorConfig,
} from "../utils";

export type BlockKind =
  | "sampler"
  | "llm"
  | "validator"
  | "expression"
  | "seed"
  | "note";
export type BlockType =
  | SamplerType
  | LlmType
  | "validator_python"
  | "validator_sql"
  | "validator_oxc"
  | "expression"
  | "string_replace"
  | "content_hash"
  | "repair_patch"
  | "conditional_ai"
  | "conditional_guard"
  | "conversation_pair"
  | "conversation_extend"
  | "agent_conversation"
  | "agent_conversation_strip_reasoning"
  | "agent_conversation_extend"
  | "agent_conversation_project"
  | "repair_tasks"
  | "repair_check"
  | "repair_merge"
  | "jsonl_export"
  | "markdown_note"
  | "seed"
  | "seed_hf"
  | "seed_local"
  | "seed_unstructured"
  | "seed_github"
  | "model_provider"
  | "model_config"
  | "tool_config";

export type SeedBlockType =
  | "seed_hf"
  | "seed_local"
  | "seed_unstructured"
  | "seed_github";

type IconType = typeof CodeIcon;

export type BlockGroup = {
  kind: BlockKind;
  title: string;
  description: string;
  icon: IconType;
};

export type BlockDialogKey =
  | "seed"
  | "markdown_note"
  | "category"
  | "subcategory"
  | "uniform"
  | "gaussian"
  | "bernoulli"
  | "datetime"
  | "timedelta"
  | "uuid"
  | "person"
  | "llm"
  | "validator"
  | "model_provider"
  | "model_config"
  | "tool_config"
  | "expression"
  | "string_replace"
  | "content_hash"
  | "repair_workflow"
  | "jsonl_export";

export type BlockDefinition = {
  kind: BlockKind;
  type: BlockType;
  title: string;
  description: string;
  icon: IconType;
  dialogKey: BlockDialogKey;
  createConfig: (id: string, existing: NodeConfig[]) => NodeConfig;
};

export const BLOCK_GROUPS: BlockGroup[] = [
  {
    kind: "sampler",
    title: "Generated fields",
    description: "Create fields from lists, ranges, and reusable patterns.",
    icon: DiceFaces03Icon,
  },
  {
    kind: "seed",
    title: "Source data",
    description: "Start from an existing dataset or file.",
    icon: Plant01Icon,
  },
  {
    kind: "llm",
    title: "AI generation",
    description: "Generate content, connect models, and manage tools.",
    icon: PencilEdit02Icon,
  },
  {
    kind: "validator",
    title: "Checks",
    description:
      "Validate generated fields and repair candidates as data moves through the recipe.",
    icon: Shield02Icon,
  },
  {
    kind: "expression",
    title: "Formulas & outputs",
    description: "Build fields or save the final dataset result.",
    icon: FunctionIcon,
  },
  {
    kind: "note",
    title: "Notes",
    description: "Add markdown notes to document your flow.",
    icon: PencilEdit02Icon,
  },
];

const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    kind: "seed",
    type: "seed_hf",
    title: "Hugging Face dataset",
    description: "Use rows from a Hugging Face dataset as source data.",
    icon: Plant01Icon,
    dialogKey: "seed",
    createConfig: (id, existing) => makeSeedConfig(id, existing, "hf"),
  },
  {
    kind: "seed",
    type: "seed_local",
    title: "CSV or JSON file",
    description: "Upload CSV, JSON, or JSONL and use its rows as source data.",
    icon: DocumentCodeIcon,
    dialogKey: "seed",
    createConfig: (id, existing) => makeSeedConfig(id, existing, "local"),
  },
  {
    kind: "seed",
    type: "seed_unstructured",
    title: "Document file",
    description: "Upload PDF, DOCX, or TXT and turn it into source rows.",
    icon: DocumentAttachmentIcon,
    dialogKey: "seed",
    createConfig: (id, existing) =>
      makeSeedConfig(id, existing, "unstructured"),
  },
  {
    kind: "seed",
    type: "seed_github",
    title: "GitHub repositories",
    description:
      "Crawl issues, pull requests, and commits from one or more GitHub repos.",
    icon: GithubIcon,
    dialogKey: "seed",
    createConfig: (id, existing) => makeSeedConfig(id, existing, "github_repo"),
  },
  {
    kind: "sampler",
    type: "category",
    title: "Category",
    description:
      "Generate values from a list you define, with optional weights or rules.",
    icon: Tag01Icon,
    dialogKey: "category",
    createConfig: (id, existing) => makeSamplerConfig(id, "category", existing),
  },
  {
    kind: "sampler",
    type: "subcategory",
    title: "Subcategory",
    description: "Generate values from groups you define for each category.",
    icon: TagsIcon,
    dialogKey: "subcategory",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "subcategory", existing),
  },
  {
    kind: "sampler",
    type: "uniform",
    title: "Random number",
    description: "Generate a number anywhere between a minimum and maximum.",
    icon: EqualSignIcon,
    dialogKey: "uniform",
    createConfig: (id, existing) => makeSamplerConfig(id, "uniform", existing),
  },
  {
    kind: "sampler",
    type: "gaussian",
    title: "Bell-curve number",
    description: "Generate numbers around an average value.",
    icon: Parabola02Icon,
    dialogKey: "gaussian",
    createConfig: (id, existing) => makeSamplerConfig(id, "gaussian", existing),
  },
  {
    kind: "sampler",
    type: "bernoulli",
    title: "Yes/no value",
    description: "Generate a binary result from a probability.",
    icon: EqualSignIcon,
    dialogKey: "bernoulli",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "bernoulli", existing),
  },
  {
    kind: "sampler",
    type: "datetime",
    title: "Date and time",
    description: "Generate timestamps inside a date range.",
    icon: Clock01Icon,
    dialogKey: "datetime",
    createConfig: (id, existing) => makeSamplerConfig(id, "datetime", existing),
  },
  {
    kind: "sampler",
    type: "timedelta",
    title: "Time offset",
    description: "Generate a time difference from another date field.",
    icon: Clock01Icon,
    dialogKey: "timedelta",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "timedelta", existing),
  },
  {
    kind: "sampler",
    type: "uuid",
    title: "Unique ID",
    description: "Generate unique identifiers.",
    icon: FingerPrintIcon,
    dialogKey: "uuid",
    createConfig: (id, existing) => makeSamplerConfig(id, "uuid", existing),
  },
  {
    kind: "sampler",
    type: "identity",
    title: "Identity",
    description: "Define a reusable identity or generate a Faker-backed one.",
    icon: UserAccountIcon,
    dialogKey: "person",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "identity", existing),
  },
  {
    kind: "llm",
    type: "text",
    title: "AI text",
    description: "Generate text from your prompt.",
    icon: PencilEdit02Icon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "text", existing),
  },
  {
    kind: "llm",
    type: "structured",
    title: "AI structured data",
    description: "Generate JSON that follows a response format.",
    icon: CodeIcon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "structured", existing),
  },
  {
    kind: "llm",
    type: "conditional_ai",
    title: "Conditional AI repair",
    description:
      "Generate structured output only for rows that match a condition.",
    icon: PencilEdit02Icon,
    dialogKey: "llm",
    createConfig: (id, existing) =>
      makeConditionalRepairLlmConfig(id, "repair", existing),
  },
  {
    kind: "llm",
    type: "conditional_guard",
    title: "Conditional AI validation",
    description:
      "Semantically approve only structurally valid repair candidates.",
    icon: Shield02Icon,
    dialogKey: "llm",
    createConfig: (id, existing) =>
      makeConditionalRepairLlmConfig(id, "guard", existing),
  },
  {
    kind: "llm",
    type: "code",
    title: "AI code",
    description: "Generate code in the language you choose.",
    icon: CodeSimpleIcon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "code", existing),
  },
  {
    kind: "llm",
    type: "judge",
    title: "AI scorer",
    description: "Score outputs against your criteria.",
    icon: BalanceScaleIcon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "judge", existing),
  },
  {
    kind: "llm",
    type: "model_provider",
    title: "Provider connection",
    description: "Choose where model requests go and how to sign in.",
    icon: Shield02Icon,
    dialogKey: "model_provider",
    createConfig: (id, existing) => makeModelProviderConfig(id, existing),
  },
  {
    kind: "llm",
    type: "model_config",
    title: "Model preset",
    description: "Pick a model and save reusable generation settings.",
    icon: Plant01Icon,
    dialogKey: "model_config",
    createConfig: (id, existing) => makeModelConfig(id, existing),
  },
  {
    kind: "llm",
    type: "tool_config",
    title: "Tool access",
    description: "Choose which tools an AI step can use.",
    icon: Plug01Icon,
    dialogKey: "tool_config",
    createConfig: (id, existing) => makeToolProfileConfig(id, existing),
  },
  {
    kind: "validator",
    type: "validator_python",
    title: "Python check",
    description: "Lint generated Python and filter out rows that fail.",
    icon: Shield02Icon,
    dialogKey: "validator",
    createConfig: (id, existing) =>
      makeValidatorConfig(id, "code", "python", existing),
  },
  {
    kind: "validator",
    type: "validator_sql",
    title: "SQL check",
    description: "Lint generated SQL and filter out rows that fail.",
    icon: Shield02Icon,
    dialogKey: "validator",
    createConfig: (id, existing) =>
      makeValidatorConfig(id, "code", "sql:sqlite", existing),
  },
  {
    kind: "validator",
    type: "validator_oxc",
    title: "JS/TS check",
    description:
      "Lint generated JavaScript or TypeScript and filter out rows that fail.",
    icon: Shield02Icon,
    dialogKey: "validator",
    createConfig: (id, existing) =>
      makeValidatorConfig(id, "oxc", "javascript", existing),
  },
  {
    kind: "validator",
    type: "repair_tasks",
    title: "Extract repair tasks",
    description:
      "Collect failed judge criteria into compact keyed repair instructions.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "repair_tasks", existing),
  },
  {
    kind: "validator",
    type: "repair_check",
    title: "Check repair candidate",
    description:
      "Verify UUID, roles, turn count, and protected conversation entries.",
    icon: Shield02Icon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "repair_check", existing),
  },
  {
    kind: "expression",
    type: "expression",
    title: "Formula",
    description: "Build or transform a field using other fields.",
    icon: FunctionIcon,
    dialogKey: "expression",
    createConfig: (id, existing) => makeExpressionConfig(id, existing),
  },
  {
    kind: "expression",
    type: "string_replace",
    title: "String replace",
    description:
      "Replace occurrences in a field with fixed text or a regex pattern.",
    icon: FunctionIcon,
    dialogKey: "string_replace",
    createConfig: (id, existing) => makeStringReplaceConfig(id, existing),
  },
  {
    kind: "expression",
    type: "content_hash",
    title: "Content hash",
    description:
      "Compute a stable sha256 content hash of a field, addressable as a block id.",
    icon: FunctionIcon,
    dialogKey: "content_hash",
    createConfig: (id, existing) => makeContentHashConfig(id, existing),
  },
  {
    kind: "expression",
    type: "repair_patch",
    title: "Apply repair patch",
    description:
      "Apply hash-aware edits to a text field and emit child hash metadata.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) => makeRepairPatchConfig(id, existing),
  },
  {
    kind: "expression",
    type: "conversation_pair",
    title: "Build conversation pair",
    description:
      "Combine one human message and one AI response into fixed human/gpt turns.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "conversation_pair", existing),
  },
  {
    kind: "expression",
    type: "conversation_extend",
    title: "Extend conversation",
    description:
      "Append one new human message and one new AI response onto an existing conversation.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "conversation_extend", existing),
  },
  {
    kind: "expression",
    type: "agent_conversation",
    title: "Build agent conversation",
    description:
      "Combine a natural user message with an AI trace while preserving tool calls and results.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "agent_conversation", existing),
  },
  {
    kind: "expression",
    type: "agent_conversation_extend",
    title: "Extend agent conversation",
    description:
      "Append a natural user turn and complete tool trace to an existing agent history.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "agent_conversation_extend", existing),
  },
  {
    kind: "expression",
    type: "agent_conversation_strip_reasoning",
    title: "Strip agent reasoning",
    description:
      "Remove reasoning blocks from prior assistant turns while preserving tool history.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(
        id,
        "agent_conversation_strip_reasoning",
        existing,
      ),
  },
  {
    kind: "expression",
    type: "agent_conversation_project",
    title: "Project agent conversation",
    description:
      "Project natural user and final assistant turns for ShareGPT-compatible judges.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "agent_conversation_project", existing),
  },
  {
    kind: "expression",
    type: "repair_merge",
    title: "Apply approved repairs",
    description:
      "Replace conversations only when the keyed repair was approved.",
    icon: FunctionIcon,
    dialogKey: "repair_workflow",
    createConfig: (id, existing) =>
      makeRepairWorkflowConfig(id, "repair_merge", existing),
  },
  {
    kind: "expression",
    type: "jsonl_export",
    title: "Export JSONL",
    description:
      "Save a final conversation field as a downloadable JSONL artifact.",
    icon: DocumentAttachmentIcon,
    dialogKey: "jsonl_export",
    createConfig: (id, existing) => makeJsonlExportConfig(id, existing),
  },
  {
    kind: "note",
    type: "markdown_note",
    title: "Note",
    description: "Add a note to the canvas. Notes do not affect the run.",
    icon: PencilEdit02Icon,
    dialogKey: "markdown_note",
    createConfig: (id, existing) => makeMarkdownNoteConfig(id, existing),
  },
];

export function getBlocksForKind(kind: BlockKind): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((block) => block.kind === kind);
}

export function getBlockDefinition(
  kind: BlockKind,
  type: BlockType,
): BlockDefinition | null {
  return (
    BLOCK_DEFINITIONS.find(
      (block) => block.kind === kind && block.type === type,
    ) ?? null
  );
}

export function getBlockDefinitionForConfig(
  config: NodeConfig | null,
): BlockDefinition | null {
  if (!config) {
    return null;
  }
  if (config.kind === "seed") {
    const seedType: Record<SeedSourceType, SeedBlockType> = {
      hf: "seed_hf",
      local: "seed_local",
      unstructured: "seed_unstructured",
      github_repo: "seed_github",
    };
    return getBlockDefinition(
      "seed",
      seedType[config.seed_source_type ?? "hf"],
    );
  }
  if (config.kind === "sampler") {
    const samplerType =
      config.sampler_type === "person" ||
      config.sampler_type === "person_from_faker" ||
      config.sampler_type === "synthetic_persona"
        ? "identity"
        : config.sampler_type;
    return getBlockDefinition("sampler", samplerType);
  }
  if (config.kind === "llm") {
    if (config.run_if?.trim()) {
      const conditionalType = config.output_format?.includes('"approved"')
        ? "conditional_guard"
        : "conditional_ai";
      return getBlockDefinition("llm", conditionalType);
    }
    return getBlockDefinition("llm", config.llm_type);
  }
  if (config.kind === "validator") {
    if (config.validator_type === "oxc") {
      return getBlockDefinition("validator", "validator_oxc");
    }
    const isSql = config.code_lang.startsWith("sql:");
    return getBlockDefinition(
      "validator",
      isSql ? "validator_sql" : "validator_python",
    );
  }
  if (config.kind === "model_provider") {
    return getBlockDefinition("llm", "model_provider");
  }
  if (config.kind === "model_config") {
    return getBlockDefinition("llm", "model_config");
  }
  if (config.kind === "tool_config") {
    return getBlockDefinition("llm", "tool_config");
  }
  if (config.kind === "markdown_note") {
    return getBlockDefinition("note", "markdown_note");
  }
  if (
    config.kind === "expression" &&
    config.expression_type &&
    config.expression_type !== "formula"
  ) {
    if (config.expression_type === "jsonl_export") {
      return getBlockDefinition("expression", "jsonl_export");
    }
    return getBlockDefinition(
      config.expression_type === "repair_merge" ||
        config.expression_type === "conversation_pair" ||
        config.expression_type === "conversation_extend" ||
        config.expression_type === "agent_conversation" ||
        config.expression_type === "agent_conversation_strip_reasoning" ||
        config.expression_type === "agent_conversation_extend" ||
        config.expression_type === "agent_conversation_project" ||
        config.expression_type === "string_replace" ||
        config.expression_type === "content_hash" ||
        config.expression_type === "repair_patch"
        ? "expression"
        : "validator",
      config.expression_type ?? "expression",
    );
  }
  return getBlockDefinition("expression", "expression");
}
