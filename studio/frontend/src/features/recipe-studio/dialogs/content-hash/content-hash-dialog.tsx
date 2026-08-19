// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { Input } from "@/components/ui/input";
import type { ReactElement } from "react";
import type { ExpressionConfig } from "../../types";
import { AvailableVariables } from "../shared/available-variables";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

type ContentHashDialogProps = {
  config: ExpressionConfig;
  onUpdate: (patch: Partial<ExpressionConfig>) => void;
};

export function ContentHashDialog({
  config,
  onUpdate,
}: ContentHashDialogProps): ReactElement {
  const sourceColumnId = `${config.id}-source-column`;
  const hashLengthId = `${config.id}-hash-length`;

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
          hint="The field whose value is hashed. Identical content hashes identically regardless of row."
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
      <div className="grid gap-1.5">
        <FieldLabel
          label="Hash length"
          htmlFor={hashLengthId}
          hint="Leading hex characters to keep. 64 is a full sha256 digest."
        />
        <Input
          id={hashLengthId}
          className="nodrag font-mono"
          placeholder="64"
          value={config.hash_length ?? "64"}
          onChange={(event) =>
            onUpdate({ hash_length: event.target.value })
          }
        />
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Deterministically hashes the source field value. The result is a stable
        content address for the cell, usable as a parent or span hash by the
        repair patch step. Strings are hashed verbatim; other values are
        serialized with sorted keys.
      </div>
    </div>
  );
}