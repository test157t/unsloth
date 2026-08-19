// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ReactElement } from "react";
import type { ExpressionConfig } from "../../types";
import { AvailableVariables } from "../shared/available-variables";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

type StringReplaceDialogProps = {
  config: ExpressionConfig;
  onUpdate: (patch: Partial<ExpressionConfig>) => void;
};

export function StringReplaceDialog({
  config,
  onUpdate,
}: StringReplaceDialogProps): ReactElement {
  const sourceColumnId = `${config.id}-source-column`;
  const findId = `${config.id}-find`;
  const replaceId = `${config.id}-replace`;
  const regexId = `${config.id}-regex`;

  return (
    <div className="space-y-4">
      <NameField
        value={config.name}
        onChange={(value) => onUpdate({ name: value })}
      />
      <AvailableVariables configId={config.id} />
      <div className="grid gap-1.5">
        <FieldLabel
          label="Source field"
          htmlFor={sourceColumnId}
          hint="The field whose text is replaced. Its value is copied with replacements applied in place."
        />
        <Input
          id={sourceColumnId}
          className="nodrag"
          placeholder="assistant_response"
          value={config.source_column ?? ""}
          onChange={(event) =>
            onUpdate({ source_column: event.target.value })
          }
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2">
        <div>
          <p className="text-sm font-semibold">Use regex</p>
          <p className="text-xs text-muted-foreground">
            Treat the find pattern as a regular expression instead of literal
            text.
          </p>
        </div>
        <Switch
          checked={Boolean(config.use_regex)}
          onCheckedChange={(checked) => onUpdate({ use_regex: checked })}
        />
      </div>
      <div className="grid gap-1.5">
        <FieldLabel
          label={config.use_regex ? "Pattern" : "Find"}
          htmlFor={findId}
          hint={
            config.use_regex
              ? "Regular expression matched against the source field text."
              : "Exact text occurrence to find and replace."
          }
        />
        <Input
          id={findId}
          className="nodrag font-mono"
          placeholder={config.use_regex ? "\\\\n+\\\\s*" : "old text"}
          value={config.find ?? ""}
          onChange={(event) => onUpdate({ find: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <FieldLabel
          label="Replace with"
          htmlFor={replaceId}
          hint="The replacement text. With regex enabled, backreference groups like \\1 are supported."
        />
        <Input
          id={replaceId}
          className="nodrag font-mono"
          placeholder="new text"
          value={config.replace_with ?? ""}
          onChange={(event) =>
            onUpdate({ replace_with: event.target.value })
          }
        />
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Deterministically rewrites the source field column. The original column
        is left untouched; this node writes the result into its own output
        field.
      </div>
    </div>
  );
}