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
    | "uuid_column"
    | "judge_column"
    | "threshold"
    | "conversations_column"
    | "candidate_column"
    | "approval_column";
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
  return (
    <div className="space-y-4">
      <NameField
        value={config.name}
        onChange={(value) => onUpdate({ name: value })}
      />
      <AvailableVariables configId={config.id} />
      <TextField
        config={config}
        field="uuid_column"
        label="Row UUID field"
        hint="Stable key copied into every repair task and candidate."
        placeholder="row_uuid"
        onUpdate={onUpdate}
      />
      {type === "repair_tasks" ? (
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
      ) : (
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
            hint="Structured output containing row_uuid, did_rewrite, and conversations."
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
        </>
      )}
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        {type === "repair_tasks" &&
          "Outputs { row_uuid, repairs[] }. Empty repairs let conditional AI skip the row without a model request."}
        {type === "repair_check" &&
          "Rejects UUID mismatches, changed user/system turns, role changes, and turn-count changes."}
        {type === "repair_merge" &&
          "Uses the repaired conversations only when the candidate is keyed correctly and approval is true."}
      </div>
    </div>
  );
}
