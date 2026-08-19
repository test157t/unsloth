// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type ReactElement, useEffect } from "react";
import type { SamplerConfig } from "../../types";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

type PersonDialogProps = {
  config: SamplerConfig;
  onUpdate: (patch: Partial<SamplerConfig>) => void;
};

type IdentityField =
  | "person_name"
  | "person_locale"
  | "person_sex"
  | "person_age_range"
  | "person_city"
  | "person_planet"
  | "person_role";

export function PersonDialog({
  config,
  onUpdate,
}: PersonDialogProps): ReactElement {
  useEffect(() => {
    if (config.sampler_type !== "identity") {
      onUpdate({
        // biome-ignore lint/style/useNamingConvention: api schema
        sampler_type: "identity",
        // biome-ignore lint/style/useNamingConvention: legacy ui schema
        person_with_synthetic_personas: undefined,
      });
    }
  }, [config.sampler_type, onUpdate]);

  const field = (
    key: IdentityField,
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
          onChange={(event) =>
            onUpdate({ [key]: event.target.value } as Partial<SamplerConfig>)
          }
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
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        This outputs one reusable identity object per row. Reference the whole
        identity as {`{{ ${config.name} }}`} or individual fields such as
        {` {{ ${config.name}.description }}`} in repair, judge, and guard
        prompts.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "person_name",
          "Identity name",
          "Leave blank to generate a Faker name for each row.",
          "Ari, Kim, Robin…",
        )}
        {field(
          "person_role",
          "Pipeline role",
          "Optional purpose carried with the identity.",
          "Conservative conversation rewriter",
        )}
        {field(
          "person_sex",
          "Gender or identity",
          "Optional free text; custom identities are supported.",
          "woman, nonbinary, synthetic intelligence…",
        )}
        {field(
          "person_age_range",
          "Age or age range",
          "Optional. Use 32 or 24-40; blank omits age entirely.",
          "",
        )}
        {field(
          "person_city",
          "City",
          "Optional. Blank means the identity has no defined city.",
          "",
        )}
        {field(
          "person_planet",
          "Planet or world",
          "Optional and entirely custom.",
          "Earth, Mars, Elysium…",
        )}
        {field(
          "person_locale",
          "Faker locale",
          "Used only when the identity name is generated.",
          "en_US",
        )}
      </div>
      <div className="grid gap-1.5">
        <FieldLabel
          label="Identity details"
          htmlFor={`${config.id}-person-description`}
          hint="Identity, voice, priorities, and constraints exposed to downstream prompts."
        />
        <Textarea
          id={`${config.id}-person-description`}
          className="nodrag min-h-36"
          value={config.person_description ?? ""}
          placeholder="Describe the identity in first person, with their voice, priorities, and boundaries…"
          onChange={(event) =>
            onUpdate({ person_description: event.target.value })
          }
        />
      </div>
    </div>
  );
}
