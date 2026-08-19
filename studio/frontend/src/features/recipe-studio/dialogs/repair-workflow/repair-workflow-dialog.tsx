// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { Input } from "@/components/ui/input";
import type { ReactElement } from "react";
import type { ExpressionConfig } from "../../types";
import { AvailableVariables } from "../shared/available-variables";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

type RepairWorkflowDialogProps = {
  config: ExpressionConfig;
  onUpdate: (patch: Partial<ExpressionConfig>) => void;
};

function TextField({
  config,
  field,
  label,
  hint,
  placeholder,
  onUpdate,
}: {
  config: ExpressionConfig;
  field:
    | "human_column"
    | "assistant_column"
    | "uuid_column"
    | "judge_column"
    | "threshold"
    | "conversations_column"
    | "candidate_column"
    | "approval_column"
    | "internal_thought_tag"
    | "source_column"
    | "patch_column"
    | "hash_length";
  label: string;
  hint: string;
  placeholder: string;
  onUpdate: (patch: Partial<ExpressionConfig>) => void;
}): ReactElement {
  const id = `${config.id}-${field}`;
  return (
    <div className="grid gap-1.5">
      <FieldLabel label={label} htmlFor={id} hint={hint} />
      <Input
        id={id}
        className="nodrag"
        value={config[field] ?? ""}
        placeholder={placeholder}
        onChange={(event) => onUpdate({ [field]: event.target.value })}
      />
    </div>
  );
}

export function RepairWorkflowDialog({
  config,
  onUpdate,
}: RepairWorkflowDialogProps): ReactElement {
  const type = config.expression_type ?? "repair_tasks";
  const isPatch = type === "repair_patch";
  return (
    <div className="space-y-4">
      <NameField
        value={config.name}
        onChange={(value) => onUpdate({ name: value })}
      />
      <AvailableVariables configId={config.id} />
      {type === "conversation_pair" || type === "conversation_extend" ? (
        <>
          {type === "conversation_extend" && (
            <TextField
              config={config}
              field="conversations_column"
              label="Original conversations field"
              hint="The conversation this step appends one new human/gpt pair onto."
              placeholder="conversations"
              onUpdate={onUpdate}
            />
          )}
          <TextField
            config={config}
            field="human_column"
            label="New human message field"
            hint="One generated raw human message. It becomes the appended human turn."
            placeholder="human_followup"
            onUpdate={onUpdate}
          />
          <TextField
            config={config}
            field="assistant_column"
            label="New AI response field"
            hint="One complete raw response, including any reasoning tags and visible answer."
            placeholder="assistant_response"
            onUpdate={onUpdate}
          />
        </>
      ) : (
        <TextField
          config={config}
          field="uuid_column"
          label="Row UUID field"
          hint="Stable key copied into every repair task and candidate."
          placeholder="row_uuid"
          onUpdate={onUpdate}
        />
      )}
      {isPatch ? (
        <>
          <TextField
            config={config}
            field="source_column"
            label="Source field"
            hint="The exact text block being patched. Hashing it must match the patch parent_hash."
            placeholder="rewrite_result"
            onUpdate={onUpdate}
          />
          <TextField
            config={config}
            field="patch_column"
            label="Patch field"
            hint="Structured edits containing row_uuid, parent_hash, and an edits list of hash-addressed spans."
            placeholder="repair_patch"
            onUpdate={onUpdate}
          />
          <TextField
            config={config}
            field="hash_length"
            label="Hash length"
            hint="Leading hex characters kept when hashing parent, child, and span blocks."
            placeholder="64"
            onUpdate={onUpdate}
          />
        </>
      ) : type === "repair_tasks" ? (
        <>
          <TextField
            config={config}
            field="judge_column"
            label="Judge result field"
            hint="Structured AI scorer output whose criteria contain score and reasoning."
            placeholder="llm_judge_1"
            onUpdate={onUpdate}
          />
          <TextField
            config={config}
            field="threshold"
            label="Repair scores below"
            hint="Only criteria below this numeric score become repair tasks."
            placeholder="4"
            onUpdate={onUpdate}
          />
        </>
      ) : type === "repair_check" || type === "repair_merge" ? (
        <>
          <TextField
            config={config}
            field="conversations_column"
            label="Original conversations field"
            hint="The source conversation retained when a repair is invalid or rejected."
            placeholder="conversations"
            onUpdate={onUpdate}
          />
          <TextField
            config={config}
            field="candidate_column"
            label="Repair candidate field"
            hint="Structured output containing row_uuid, did_rewrite, and the repaired response."
            placeholder="rewrite_result"
            onUpdate={onUpdate}
          />
          {type === "repair_merge" && (
            <TextField
              config={config}
              field="approval_column"
              label="Approval field"
              hint="Boolean or structured result containing approved or valid."
              placeholder="rewrite_guard"
              onUpdate={onUpdate}
            />
          )}
          <TextField
            config={config}
            field="internal_thought_tag"
            label="Reasoning tag"
            hint="The tag the model wraps private reasoning in. The repair and guard prompts must use the same tag."
            placeholder="Internal-Thoughts"
            onUpdate={onUpdate}
          />
        </>
      ) : null}
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        {type === "conversation_pair" &&
          "Always outputs exactly two turns: one human followed by one gpt. The AI cannot add roles or split reasoning into another turn."}
        {type === "conversation_extend" &&
          "Appends exactly one human followed by one gpt turn onto the original array in code; the original turns are never re-emitted by a model."}
        {type === "repair_tasks" &&
          "Outputs { row_uuid, repairs[] }. Empty repairs let conditional AI skip the row without a model request."}
        {type === "repair_check" &&
          "Rejects UUID mismatches, missing or unchanged rewritten responses, and malformed internal-thought content."}
        {type === "repair_merge" &&
          "Replaces only the gpt/assistant response with the approved rewrite; human and system turns always come from the original."}
        {isPatch &&
          "Applies the structured patch deterministically: verifies the row UUID and parent hash, splices each hash-addressed span, and emits the patched response plus parent and child hashes as metadata."}
      </div>
    </div>
  );
}
