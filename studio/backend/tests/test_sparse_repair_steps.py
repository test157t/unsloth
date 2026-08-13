# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import importlib.util
from pathlib import Path


_MODULE_PATH = Path(__file__).parents[1] / "core" / "data_recipe" / "sparse_repair_steps.py"
_SPEC = importlib.util.spec_from_file_location("sparse_repair_steps", _MODULE_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)
extract_repair_tasks = _MODULE.extract_repair_tasks
merge_approved_repair = _MODULE.merge_approved_repair
split_sparse_repair_columns = _MODULE.split_sparse_repair_columns
validate_repair_candidate = _MODULE.validate_repair_candidate


ORIGINAL = [
    {"from": "human", "value": "Hello"},
    {"from": "assistant", "value": "Plain answer"},
]
CANDIDATE = {
    "row_uuid": "row-1",
    "did_rewrite": True,
    "conversations": [
        {"from": "human", "value": "Hello"},
        {"from": "assistant", "value": "Distinctly repaired answer"},
    ],
}


def test_extracts_only_failed_judge_criteria() -> None:
    result = extract_repair_tasks(
        {
            "row_uuid": "row-1",
            "judge": {
                "personality": {"score": 2, "reasoning": "Generic voice."},
                "grammar": {"score": 4, "reasoning": "Clean."},
            },
        },
        uuid_column = "row_uuid",
        judge_column = "judge",
        threshold = 4,
    )
    assert result == {
        "row_uuid": "row-1",
        "repairs": [
            {"criterion": "personality", "score": 2.0, "reason": "Generic voice."}
        ],
    }


def test_candidate_check_protects_non_assistant_turns() -> None:
    altered = {
        **CANDIDATE,
        "conversations": [
            {"from": "human", "value": "Changed request"},
            CANDIDATE["conversations"][1],
        ],
    }
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": ORIGINAL,
            "candidate": altered,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is False
    assert "protected turn" in result["reason"]


def test_merge_uses_approved_keyed_candidate_and_falls_back_otherwise() -> None:
    row = {
        "row_uuid": "row-1",
        "conversations": ORIGINAL,
        "candidate": CANDIDATE,
        "approval": {"approved": True},
    }
    assert merge_approved_repair(
        row,
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
        approval_column = "approval",
    ) == CANDIDATE["conversations"]
    row["approval"] = {"approved": False}
    assert merge_approved_repair(
        row,
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
        approval_column = "approval",
    ) == ORIGINAL


def test_sparse_columns_are_removed_before_data_designer_parsing() -> None:
    recipe, specs = split_sparse_repair_columns(
        {
            "columns": [
                {"column_type": "llm-judge", "name": "judge"},
                {"column_type": "unsloth-repair-tasks", "name": "tasks"},
            ]
        }
    )
    assert [column["name"] for column in recipe["columns"]] == ["judge"]
    assert [column["name"] for column in specs] == ["tasks"]
