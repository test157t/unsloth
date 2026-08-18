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
extend_conversation_turns = _MODULE.extend_conversation_turns
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
    "response": "Distinctly repaired answer",
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


def test_extend_appends_one_human_and_one_gpt_turn_verbatim() -> None:
    result = extend_conversation_turns(
        {
            "conversations": ORIGINAL,
            "human_followup": "Tell me more.",
            "mia_response": "Fresh gpt answer.",
        },
        conversations_column = "conversations",
        human_column = "human_followup",
        assistant_column = "mia_response",
    )
    assert result == [
        {"from": "human", "value": "Hello"},
        {"from": "assistant", "value": "Plain answer"},
        {"from": "human", "value": "Tell me more."},
        {"from": "gpt", "value": "Fresh gpt answer."},
    ]


def test_extend_preserves_the_source_conversation_objects() -> None:
    source = [
        {"from": "human", "value": "First", "extra": "kept?"},
        {"from": "gpt", "value": "Second"},
    ]
    result = extend_conversation_turns(
        {
            "conversations": source,
            "human_followup": "Next",
            "mia_response": "Reply",
        },
        conversations_column = "conversations",
        human_column = "human_followup",
        assistant_column = "mia_response",
    )
    assert result[0] == {"from": "human", "value": "First", "extra": "kept?"}
    assert result[0] is not source[0]
    assert result[1:] == [
        {"from": "gpt", "value": "Second"},
        {"from": "human", "value": "Next"},
        {"from": "gpt", "value": "Reply"},
    ]


def test_extend_decodes_stored_json_conversations() -> None:
    result = extend_conversation_turns(
        {
            "conversations": json.dumps(ORIGINAL),
            "human_followup": "More",
            "mia_response": "Answer",
        },
        conversations_column = "conversations",
        human_column = "human_followup",
        assistant_column = "mia_response",
    )
    assert len(result) == len(ORIGINAL) + 2
    assert result[-2] == {"from": "human", "value": "More"}
    assert result[-1] == {"from": "gpt", "value": "Answer"}


def test_extend_rejects_a_non_list_conversations_value() -> None:
    try:
        extend_conversation_turns(
            {
                "conversations": "not-a-list",
                "human_followup": "More",
                "mia_response": "Answer",
            },
            conversations_column = "conversations",
            human_column = "human_followup",
            assistant_column = "mia_response",
        )
    except ValueError as exc:
        assert "must be a list" in str(exc)
    else:
        raise AssertionError("Expected a non-list value to be rejected.")


def test_extend_rejects_missing_new_turn_text() -> None:
    try:
        extend_conversation_turns(
            {
                "conversations": ORIGINAL,
                "human_followup": "   ",
                "mia_response": "Answer",
            },
            conversations_column = "conversations",
            human_column = "human_followup",
            assistant_column = "mia_response",
        )
    except ValueError as exc:
        assert "human_followup" in str(exc)
    else:
        raise AssertionError("Expected blank human text to be rejected.")


def test_extract_only_failed_judge_criteria() -> None:
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


def test_candidate_check_accepts_a_rewritten_response() -> None:
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": ORIGINAL,
            "candidate": CANDIDATE,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is True
    assert "assistant response" in result["reason"]


def test_candidate_check_allows_sharegpt_gpt_turns() -> None:
    original = [
        {"from": "human", "value": "Hello"},
        {"from": "gpt", "value": "Plain answer"},
    ]
    candidate = {
        "row_uuid": "row-1",
        "did_rewrite": True,
        "response": "Distinctly repaired answer",
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


def test_candidate_check_rejects_an_unchanged_response() -> None:
    candidate = {
        **CANDIDATE,
        "response": ORIGINAL[1]["value"],
    }
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": ORIGINAL,
            "candidate": candidate,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is False
    assert "did not change the assistant response" in result["reason"]


def test_candidate_check_rejects_a_missing_response() -> None:
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": ORIGINAL,
            "candidate": {"row_uuid": "row-1", "did_rewrite": True},
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is False
    assert "did not supply a rewritten response" in result["reason"]


def test_candidate_check_requires_an_assistant_turn_to_repair() -> None:
    result = validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": [{"from": "human", "value": "Hello"}],
            "candidate": CANDIDATE,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )
    assert result["valid"] is False
    assert "no assistant or model turn to repair" in result["reason"]


def _validate_assistant_rewrite(value: str) -> dict:
    candidate = {**CANDIDATE, "response": value}
    return validate_repair_candidate(
        {
            "row_uuid": "row-1",
            "conversations": ORIGINAL,
            "candidate": candidate,
        },
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
    )


def test_candidate_check_accepts_valid_plain_assistant_response() -> None:
    assert _validate_assistant_rewrite("A repaired visible answer.")["valid"] is True


def test_candidate_check_accepts_closed_thoughts_with_visible_answer() -> None:
    value = (
        "<Mia_Internal-Thoughts>Check the repair.</Mia_Internal-Thoughts>\n"
        "A repaired visible answer."
    )
    assert _validate_assistant_rewrite(value)["valid"] is True


def test_candidate_check_rejects_unclosed_internal_thought_opening_tag() -> None:
    result = _validate_assistant_rewrite(
        "<Mia_Internal-Thoughts>Check the repair.\nA supposed answer."
    )
    assert result["valid"] is False
    assert "unclosed internal-thought opening tag" in result["reason"]


def test_candidate_check_rejects_unmatched_internal_thought_closing_tag() -> None:
    result = _validate_assistant_rewrite(
        "Check the repair.</Mia_Internal-Thoughts>\nA supposed answer."
    )
    assert result["valid"] is False
    assert "unmatched internal-thought closing tag" in result["reason"]


def test_candidate_check_rejects_reasoning_only_content() -> None:
    result = _validate_assistant_rewrite(
        "<Mia_Internal-Thoughts>Only private reasoning.</Mia_Internal-Thoughts>"
    )
    assert result["valid"] is False
    assert "no non-empty visible answer" in result["reason"]


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


def test_merge_replaces_only_the_assistant_turn_and_keeps_human_turns() -> None:
    row = {
        "row_uuid": "row-1",
        "conversations": ORIGINAL,
        "candidate": CANDIDATE,
        "approval": {"approved": True},
    }
    merged = merge_approved_repair(
        row,
        uuid_column = "row_uuid",
        conversations_column = "conversations",
        candidate_column = "candidate",
        approval_column = "approval",
    )
    assert merged == [
        {"from": "human", "value": "Hello"},
        {"from": "assistant", "value": "Distinctly repaired answer"},
    ]
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


def test_merge_preserves_original_when_guard_approves_invalid_content() -> None:
    invalid_candidate = {
        **CANDIDATE,
        "response": "<Mia_Internal-Thoughts>Unclosed reasoning",
    }
    row = {
        "row_uuid": "row-1",
        "conversations": ORIGINAL,
        "candidate": invalid_candidate,
        "approval": {"approved": True},
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