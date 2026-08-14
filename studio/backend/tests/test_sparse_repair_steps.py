# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import importlib.util
import inspect
import json
from pathlib import Path


_MODULE_PATH = Path(__file__).parents[1] / "core" / "data_recipe" / "sparse_repair_steps.py"
_SPEC = importlib.util.spec_from_file_location("sparse_repair_steps", _MODULE_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)
build_conversation_pair = _MODULE.build_conversation_pair
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


def test_builds_exactly_one_human_and_one_gpt_turn() -> None:
    response = (
        "<Mia_Internal-Thoughts>Check the constraint.</Mia_Internal-Thoughts>\n"
        "One spoken answer."
    )
    result = build_conversation_pair(
        {"human_message": "One user message.", "mia_response": response},
        human_column = "human_message",
        assistant_column = "mia_response",
    )
    assert result == [
        {"from": "human", "value": "One user message."},
        {"from": "gpt", "value": response},
    ]


def test_conversation_pair_rejects_missing_text() -> None:
    try:
        build_conversation_pair(
            {"human_message": "Hello", "mia_response": ""},
            human_column = "human_message",
            assistant_column = "mia_response",
        )
    except ValueError as exc:
        assert "mia_response" in str(exc)
    else:
        raise AssertionError("Expected blank assistant text to be rejected.")


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


def test_candidate_check_allows_sharegpt_gpt_turns() -> None:
    original = [
        {"from": "human", "value": "Hello"},
        {"from": "gpt", "value": "Plain answer"},
    ]
    candidate = {
        "row_uuid": "row-1",
        "did_rewrite": True,
        "conversations": [
            {"from": "human", "value": "Hello"},
            {"from": "gpt", "value": "Distinctly repaired answer"},
        ],
    }
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": original,
            "candidate": candidate,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is True


def test_candidate_check_accepts_array_like_seed_conversations() -> None:
    class ArrayLike:
        def tolist(self):
            return ORIGINAL

    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": ArrayLike(),
            "candidate": CANDIDATE,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is True


def test_candidate_check_accepts_json_encoded_conversations() -> None:
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": json.dumps(ORIGINAL),
            "candidate": json.dumps(CANDIDATE),
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is True


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
                {"column_type": "unsloth-conversation-pair", "name": "pair"},
                {"column_type": "unsloth-repair-tasks", "name": "tasks"},
            ]
        }
    )
    assert [column["name"] for column in recipe["columns"]] == ["judge"]
    assert [column["name"] for column in specs] == ["pair", "tasks"]


def test_merge_rejects_a_guard_decision_for_another_uuid() -> None:
    row = {
        "row_uuid": "row-1",
        "conversations": ORIGINAL,
        "candidate": CANDIDATE,
        "approval": {"row_uuid": "row-2", "approved": True},
    }
    assert merge_approved_repair(
        row,
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
        approval_column = "approval",
    ) == ORIGINAL


def test_conditional_llm_generator_uses_the_synchronous_model_boundary() -> None:
    source = inspect.getsource(_MODULE._make_conditional_llm_column)
    assert "async def generate" not in source
    assert "model.generate(" in source
    assert "await model.agenerate(" not in source
