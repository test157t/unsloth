// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { Input } from "@/components/ui/input";
import type { ReactElement } from "react";
import type { ExpressionConfig } from "../../types";
import { AvailableVariables } from "../shared/available-variables";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

type JsonlExportDialogProps = {
  config: ExpressionConfig;
  onUpdate: (patch: Partial<ExpressionConfig>) => void;
};

export function JsonlExportDialog({
  config,
  onUpdate,
}: JsonlExportDialogProps): ReactElement {
  const field = (
    key:
      | "export_source_column"
      | "export_output_field"
      | "export_uuid_column"
      | "export_filename",
    label: string,
    hint: string,
    placeholder: string,
  ): ReactElement => {
    const id = `${config.id}-${key}`;
    return (
      <div className="grid gap-1.5">
        <FieldLabel label={label} htmlFor={id} hint={hint} />
        <Input
          id={id}
          className="nodrag"
          value={config[key] ?? ""}
          placeholder={placeholder}
          onChange={(event) => onUpdate({ [key]: event.target.value })}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <NameField
        value={config.name}
        onChange={(value) => onUpdate({ name: value })}
      />
      <AvailableVariables configId={config.id} />
      {field(
        "export_source_column",
        "Final conversations field",
        "The approved conversation column written to each JSONL row.",
        "repair_merge",
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "export_output_field",
          "JSONL field name",
          "Name used inside every exported JSON object.",
          "conversations",
        )}
        {field(
          "export_uuid_column",
          "UUID field (optional)",
          "Include a stable row key beside the conversations; blank omits it.",
          "row_uuid",
        )}
      </div>
      {field(
        "export_filename",
        "Download filename",
        "A .jsonl filename stored with the completed run.",
        "final-conversations.jsonl",
      )}
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Full runs create the file beside their dataset artifacts. The Runs view
        exposes it as a direct download after completion.
      </div>
    </div>
  );
}
