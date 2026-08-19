# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import importlib.util
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "core"
    / "data_recipe"
    / "identity.py"
)
SPEC = importlib.util.spec_from_file_location("identity_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class _Fake:
    def name(self) -> str:
        return "Generated Person"

    def random_int(self, *, min: int, max: int) -> int:
        return min + ((max - min) // 2)


def test_fixed_identity_keeps_custom_name_and_omits_blank_demographics() -> None:
    identity = MODULE.build_identity(
        {
            "name": "Ari",
            "gender": "synthetic woman",
            "planet": "Elysium",
            "role": "conversation rewriter",
            "description": "Repair only judged defects.",
            "city": "",
        },
        faker = _Fake(),
    )
    assert identity == {
        "name": "Ari",
        "gender": "synthetic woman",
        "planet": "Elysium",
        "role": "conversation rewriter",
        "description": "Repair only judged defects.",
    }
    assert "age" not in identity
    assert "city" not in identity


def test_blank_name_uses_faker_and_optional_range_generates_age() -> None:
    identity = MODULE.build_identity(
        {"age_range": [20, 40]},
        faker = _Fake(),
    )
    assert identity == {"name": "Generated Person", "age": 30}


def test_sample_recipe_uses_new_and_legacy_identity_sampler() -> None:
    recipe, specs = MODULE.split_identity_columns(
        {
            "columns": [
                {
                    "column_type": "sampler",
                    "sampler_type": "identity",
                    "name": "ari",
                    "params": {"name": "Ari"},
                },
                {
                    "column_type": "sampler",
                    "sampler_type": "synthetic_persona",
                    "name": "legacy_ari",
                    "params": {"name": "Legacy Ari"},
                },
                {"column_type": "sampler", "sampler_type": "uuid", "name": "id"},
            ]
        }
    )
    assert [column["name"] for column in recipe["columns"]] == ["id"]
    assert [column["name"] for column in specs] == ["ari", "legacy_ari"]