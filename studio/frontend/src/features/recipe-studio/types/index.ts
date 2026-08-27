// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import type { Node } from "@xyflow/react";

export type SamplerType =
  | "category"
  | "subcategory"
  | "uniform"
  | "gaussian"
  | "bernoulli"
  | "datetime"
  | "timedelta"
  | "uuid"
  | "person"
  | "person_from_faker"
  | "synthetic_persona"
  | "identity";

// The identity node family. `identity` is canonical; `synthetic_persona` is a
// legacy alias kept so old snapshots, imports, and saved recipes parse intact.
export const IDENTITY_SAMPLER_TYPES = new Set<SamplerType>([
  "identity",
  "synthetic_persona",
]);

// Legacy DataDesigner person samplers, distinct from the identity node.
export const LEGACY_PERSON_SAMPLER_TYPES = new Set<SamplerType>([
  "person",
  "person_from_faker",
]);

export type LlmType = "text" | "structured" | "code" | "judge";
export type ValidatorCodeLang =
  | "javascript"
  | "typescript"
  | "jsx"
  | "tsx"
  | "python"
  | "sql:sqlite"
  | "sql:postgres"
  | "sql:mysql"
  | "sql:tsql"
  | "sql:bigquery"
  | "sql:ansi";
export type ValidatorType = "code" | "oxc";
export type OxcValidationMode = "syntax" | "lint" | "syntax+lint";
export type OxcCodeShape = "auto" | "module" | "snippet";

export type ExpressionDtype = "str" | "int" | "float" | "bool";

export type LayoutDirection = "LR" | "TB";

export type SeedSamplingStrategy = "ordered" | "shuffle";
export type SeedSelectionType = "none" | "index_range" | "partition_block";
export type SeedSourceType = "hf" | "local" | "unstructured" | "github_repo";

export type GithubItemType = "issues" | "pulls" | "commits";
export type GithubStateFilter = "all" | "open" | "closed";
export const INFRA_NODE_KINDS = new Set([
  "model_provider",
  "model_config",
  "tool_config",
]);

export type RecipeNodeData = {
  title: string;
  name: string;
  kind:
    | "sampler"
    | "llm"
    | "validator"
    | "expression"
    | "seed"
    | "note"
    | "model_provider"
    | "model_config"
    | "tool_config";
  subtype: string;
  blockType:
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
    | "agent_conversation_extend"
    | "agent_conversation_project"
    | "repair_tasks"
    | "repair_check"
    | "repair_merge"
    | "jsonl_export"
    | "seed"
    | "markdown_note"
    | "model_provider"
    | "model_config"
    | "tool_config";
  layoutDirection?: LayoutDirection;
  runtimeState?: "idle" | "running" | "done";
  executionLocked?: boolean;
};

export type RecipeNode = Node<RecipeNodeData, "builder">;

export type CategoryConditionalParams = {
  // biome-ignore lint/style/useNamingConvention: api schema
  sampler_type: "category";
  values: string[];
  weights?: Array<number | null>;
};

export type SamplerConfig = {
  id: string;
  kind: "sampler";
  // ui-only
  advancedOpen?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  sampler_type: SamplerType;
  name: string;
  drop?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  convert_to?: "float" | "int" | "str";
  values?: string[];
  weights?: Array<number | null>;
  low?: string;
  high?: string;
  mean?: string;
  std?: string;
  p?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  datetime_start?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  datetime_end?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  datetime_unit?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  dt_min?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  dt_max?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  reference_column_name?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  timedelta_unit?: "D" | "h" | "m" | "s";
  // biome-ignore lint/style/useNamingConvention: api schema
  uuid_format?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_locale?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_sex?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_age_range?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_city?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_name?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_planet?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_role?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_description?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  person_with_synthetic_personas?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  subcategory_parent?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  subcategory_mapping?: Record<string, string[]>;
  // biome-ignore lint/style/useNamingConvention: api schema
  conditional_params?: Record<string, CategoryConditionalParams>;
};

export type ScoreOption = {
  value: string;
  description: string;
};

export type Score = {
  name: string;
  description: string;
  options: ScoreOption[];
};

export type McpProviderType = "studio_builtin" | "stdio" | "streamable_http";

export type McpEnvVar = {
  key: string;
  value: string;
};

export type LlmMcpProviderConfig = {
  id: string;
  name: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  provider_type: McpProviderType;
  command?: string;
  args?: string[];
  env?: McpEnvVar[];
  endpoint?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  api_key?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  api_key_env?: string;
};

export type LlmToolConfig = {
  id: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  tool_alias: string;
  providers: string[];
  // biome-ignore lint/style/useNamingConvention: api schema
  allow_tools?: string[];
  // biome-ignore lint/style/useNamingConvention: api schema
  max_tool_call_turns?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  timeout_sec?: string;
};

export type ToolProfileConfig = {
  id: string;
  kind: "tool_config";
  name: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  mcp_providers: LlmMcpProviderConfig[];
  // biome-ignore lint/style/useNamingConvention: ui schema
  fetched_tools_by_provider?: Record<string, string[]>;
  // biome-ignore lint/style/useNamingConvention: api schema
  allow_tools?: string[];
  // biome-ignore lint/style/useNamingConvention: api schema
  max_tool_call_turns?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  timeout_sec?: string;
};

export type LlmImageContextConfig = {
  enabled: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  column_name: string;
};

export type LlmTraceType = "none" | "last_message" | "all_messages";

export type LlmConfig = {
  id: string;
  kind: "llm";
  // ui-only
  advancedOpen?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  llm_type: LlmType;
  name: string;
  drop?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  model_alias: string;
  prompt: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  system_prompt: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  code_lang?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  output_format?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  tool_alias?: string;
  scores?: Score[];
  // ui-only, serialized into multi_modal_context for DataDesigner
  // biome-ignore lint/style/useNamingConvention: ui schema
  image_context?: LlmImageContextConfig;
  // biome-ignore lint/style/useNamingConvention: api schema
  with_trace?: LlmTraceType;
  // biome-ignore lint/style/useNamingConvention: api schema
  extract_reasoning_content?: boolean;
  // Unsloth extension: skip the model call unless this Jinja expression is true.
  // biome-ignore lint/style/useNamingConvention: api schema
  run_if?: string;
  // Reasoning block tag this step's prompts instruct the model to emit.
  // biome-ignore lint/style/useNamingConvention: ui schema
  internal_thought_tag?: string;
};

export type ModelProviderConfig = {
  id: string;
  kind: "model_provider";
  name: string;
  endpoint: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  provider_type: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  api_key_env?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  api_key?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  extra_headers?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  extra_body?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  is_local?: boolean;
};

export type ModelConfig = {
  id: string;
  kind: "model_config";
  name: string;
  model: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  gguf_variant?: string;
  provider: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  inference_temperature?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  inference_top_p?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  inference_max_tokens?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  inference_timeout?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  inference_extra_body?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  skip_health_check?: boolean;
};

export type ExpressionConfig = {
  id: string;
  kind: "expression";
  name: string;
  drop?: boolean;
  expr: string;
  dtype: ExpressionDtype;
  // Unsloth-native sparse repair helpers compile to local custom columns.
  // biome-ignore lint/style/useNamingConvention: ui schema
  expression_type?:
    | "formula"
    | "string_replace"
    | "content_hash"
    | "repair_patch"
    | "conversation_pair"
    | "conversation_extend"
    | "agent_conversation"
    | "agent_conversation_extend"
    | "agent_conversation_project"
    | "repair_tasks"
    | "repair_check"
    | "repair_merge"
    | "jsonl_export";
  // biome-ignore lint/style/useNamingConvention: ui schema
  uuid_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  judge_column?: string;
  threshold?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  conversations_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  candidate_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  approval_column?: string;
  // Reasoning block tag checked on repaired assistant responses.
  // biome-ignore lint/style/useNamingConvention: ui schema
  internal_thought_tag?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  human_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  assistant_column?: string;
  // Full Data Designer trace used to preserve assistant/tool messages.
  // biome-ignore lint/style/useNamingConvention: ui schema
  trace_column?: string;
  // Canonical OpenAI-style agent history used by extension/projection steps.
  // biome-ignore lint/style/useNamingConvention: ui schema
  messages_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  source_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  find?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  replace_with?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  use_regex?: boolean;
  // biome-ignore lint/style/useNamingConvention: ui schema
  patch_column?: string;
  // UI ergonomics (serialized to a number in payload)
  hash_length?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  export_source_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  export_output_field?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  export_uuid_column?: string;
  // biome-ignore lint/style/useNamingConvention: ui schema
  export_filename?: string;
};

export type ValidatorConfig = {
  id: string;
  kind: "validator";
  // ui-only
  advancedOpen?: boolean;
  name: string;
  drop?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  target_columns: string[];
  // ui-only
  validator_type: ValidatorType;
  // biome-ignore lint/style/useNamingConvention: api schema
  code_lang: ValidatorCodeLang;
  // ui-only (used for OXC validators)
  oxc_validation_mode: OxcValidationMode;
  // ui-only (used for OXC validators)
  oxc_code_shape: OxcCodeShape;
  // ui ergonomics (serialized to int in payload)
  batch_size: string;
};

export type MarkdownNoteConfig = {
  id: string;
  kind: "markdown_note";
  name: string;
  markdown: string;
  // ui-only
  note_color?: string;
  // ui-only (0-100 as string for slider/input ergonomics)
  note_opacity?: string;
};

export type SeedConfig = {
  id: string;
  kind: "seed";
  // ui-only
  advancedOpen?: boolean;
  name: string;
  drop?: boolean;
  // ui-only: explicit per-column drop for structured seed sources (hf/local)
  seed_drop_columns?: string[];
  seed_source_type: SeedSourceType;
  // ui-only (serialized in seed_config)
  hf_repo_id: string;
  hf_subset?: string;
  hf_split?: string;
  hf_path: string;
  hf_token?: string;
  hf_endpoint?: string;
  local_file_name?: string;
  // ui-only: stable per-block id for uploads, since node ids collide across imports
  unstructured_upload_uid?: string;
  unstructured_file_ids?: string[];
  unstructured_file_names?: string[];
  unstructured_file_sizes?: number[];
  // biome-ignore lint/style/useNamingConvention: api schema
  github_repo_slug?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  github_token?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  github_limit?: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  github_item_types?: GithubItemType[];
  // biome-ignore lint/style/useNamingConvention: api schema
  github_state?: GithubStateFilter;
  // biome-ignore lint/style/useNamingConvention: api schema
  github_include_comments?: boolean;
  // biome-ignore lint/style/useNamingConvention: api schema
  github_max_comments_per_item?: string;
  resolved_paths?: string[];
  // ui-only
  seed_preview_rows?: Record<string, unknown>[];
  // ui-only (string for input ergonomics)
  unstructured_chunk_size?: string;
  // ui-only (string for input ergonomics)
  unstructured_chunk_overlap?: string;
  seed_splits?: string[];
  // ui-only
  // biome-ignore lint/style/useNamingConvention: ui schema
  seed_globs_by_split?: Record<string, string>;
  seed_columns?: string[];
  sampling_strategy: SeedSamplingStrategy;
  selection_type: SeedSelectionType;
  selection_start?: string;
  selection_end?: string;
  selection_index?: string;
  selection_num_partitions?: string;
};

export type SchemaTransformProcessorConfig = {
  id: string;
  // biome-ignore lint/style/useNamingConvention: api schema
  processor_type: "schema_transform";
  name: string;
  template: string;
};

export type RecipeProcessorConfig = SchemaTransformProcessorConfig;

export type NodeConfig =
  | SamplerConfig
  | LlmConfig
  | ValidatorConfig
  | ExpressionConfig
  | MarkdownNoteConfig
  | SeedConfig
  | ModelProviderConfig
  | ModelConfig
  | ToolProfileConfig;
