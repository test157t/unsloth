# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

from typing import Any


_SAMPLER_TYPE = "synthetic_persona"


def _optional_text(params: dict[str, Any], key: str) -> str | None:
    value = params.get(key)
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def build_synthetic_persona(params: dict[str, Any], *, faker: Any) -> dict[str, Any]:
    """Build a compact persona, omitting every demographic the user left blank."""
    fixed_name = _optional_text(params, "name")
    persona: dict[str, Any] = {"name": fixed_name or faker.name()}
    for key in ("gender", "city", "planet", "role", "description"):
        value = _optional_text(params, key)
        if value is not None:
            persona[key] = value

    raw_age = params.get("age")
    if isinstance(raw_age, int) and not isinstance(raw_age, bool) and raw_age >= 0:
        persona["age"] = raw_age
    else:
        age_range = params.get("age_range")
        if (
            isinstance(age_range, list)
            and len(age_range) == 2
            and all(isinstance(value, int) and not isinstance(value, bool) for value in age_range)
        ):
            low, high = age_range
            if 0 <= low <= high:
                persona["age"] = faker.random_int(min = low, max = high)
    return persona


def split_synthetic_persona_columns(
    recipe: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    columns = recipe.get("columns")
    if not isinstance(columns, list):
        return recipe, []
    regular: list[Any] = []
    persona_specs: list[dict[str, Any]] = []
    for column in columns:
        if (
            isinstance(column, dict)
            and column.get("column_type") == "sampler"
            and column.get("sampler_type") == _SAMPLER_TYPE
        ):
            persona_specs.append(dict(column))
        else:
            regular.append(column)
    if not persona_specs:
        return recipe, []
    return {**recipe, "columns": regular}, persona_specs


def register_synthetic_persona_columns(
    *, builder: Any, specs: list[dict[str, Any]]
) -> None:
    if not specs:
        return

    from data_designer.config.column_configs import CustomColumnConfig
    from data_designer.config.custom_column import custom_column_generator
    from faker import Faker

    def make_generator(name: str, params: dict[str, Any], faker: Any):
        @custom_column_generator(required_columns = [])
        def generate(row):
            output = dict(row)
            output[name] = build_synthetic_persona(params, faker = faker)
            return output

        return generate

    for spec in specs:
        name = str(spec.get("name") or "").strip()
        if not name:
            raise ValueError("Synthetic persona step requires a name.")
        params = spec.get("params")
        if not isinstance(params, dict):
            params = {}
        locale = _optional_text(params, "locale")
        try:
            faker = Faker(locale) if locale else Faker()
        except (AttributeError, TypeError, ValueError) as exc:
            raise ValueError(f"Synthetic persona {name!r} has an invalid Faker locale.") from exc

        builder.add_column(
            CustomColumnConfig(
                name = name,
                drop = bool(spec.get("drop", False)),
                generator_function = make_generator(name, params, faker),
            )
        )
