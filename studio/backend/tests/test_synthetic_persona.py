# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import importlib.util
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "core"
    / "data_recipe"
    / "synthetic_persona.py"
)
SPEC = importlib.util.spec_from_file_location("synthetic_persona_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class _Fake:
    def name(self) -> str:
        return "Generated Person"

    def random_int(self, *, min: int, max: int) -> int:
        return min + ((max - min) // 2)


def test_fixed_persona_keeps_custom_identity_and_omits_blank_demographics() -> None:
    persona = MODULE.build_synthetic_persona(
        {
            "name": "Mia",
            "gender": "synthetic woman",
            "planet": "Elysium",
            "role": "conversation rewriter",
            "description": "Repair only judged defects.",
            "city": "",
        },
        faker = _Fake(),
    )
    assert persona == {
        "name": "Mia",
        "gender": "synthetic woman",
        "planet": "Elysium",
        "role": "conversation rewriter",
        "description": "Repair only judged defects.",
    }
    assert "age" not in persona
    assert "city" not in persona


def test_blank_name_uses_faker_and_optional_range_generates_age() -> None:
    persona = MODULE.build_synthetic_persona(
        {"age_range": [20, 40]},
        faker = _Fake(),
    )
    assert persona == {"name": "Generated Person", "age": 30}


def test_persona_sampler_is_removed_before_native_builder_validation() -> None:
    recipe, specs = MODULE.split_synthetic_persona_columns(
        {
            "columns": [
                {
                    "column_type": "sampler",
                    "sampler_type": "synthetic_persona",
                    "name": "mia",
                    "params": {"name": "Mia"},
                },
                {"column_type": "sampler", "sampler_type": "uuid", "name": "id"},
            ]
        }
    )
    assert [column["name"] for column in recipe["columns"]] == ["id"]
    assert [column["name"] for column in specs] == ["mia"]
