# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import json
import logging
import math
from typing import Any


_CONDITIONAL_PREFIX = "unsloth-conditional-"
_REPAIR_COLUMN_TYPES = {
    "unsloth-conversation-pair",
    "unsloth-conversation-extend",
    "unsloth-repair-tasks",
    "unsloth-repair-check",
    "unsloth-repair-merge",
    "unsloth-string-replace",
}
_INTERNAL_THOUGHT_OPEN = "<Mia_Internal-Thoughts>"
_INTERNAL_THOUGHT_CLOSE = "</Mia_Internal-Thoughts>"
_INTERNAL_THOUGHT_OPEN_PREFIX = "<Mia_Internal-Thoughts"
_INTERNAL_THOUGHT_CLOSE_PREFIX = "</Mia_Internal-Thoughts"

logger = logging.getLogger(__name__)


def _required_column_name(spec: dict[str, Any], key: str) -> str:
    value = str(spec.get(key) or "").strip()
    if not value:
        raise ValueError(f"Sparse repair step {spec.get('name')!r} requires {key}.")
    return value


def _decoded(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value


def _decoded_list(value: Any) -> Any:
    value = _decoded(value)
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    to_list = getattr(value, "tolist", None)
    if callable(to_list):
        converted = to_list()
        if isinstance(converted, list):
            return converted
    return value


def extract_repair_tasks(
    row: dict[str, Any],
    *,
    uuid_column: str,
    judge_column: str,
    threshold: float,
) -> dict[str, Any]:
    judge = _decoded(row.get(judge_column))
    repairs: list[dict[str, Any]] = []
    if isinstance(judge, dict):
        for criterion, result in judge.items():
            result = _decoded(result)
            if not isinstance(result, dict):
                continue
            try:
                score = float(result.get("score"))
            except (TypeError, ValueError):
                continue
            if score >= threshold:
                continue
            repairs.append(
                {
                    "criterion": str(criterion),
                    "score": score,
                    "reason": str(result.get("reasoning") or result.get("reason") or ""),
                }
            )
    return {"row_uuid": row.get(uuid_column), "repairs": repairs}


def build_conversation_pair(
    row: dict[str, Any],
    *,
    human_column: str,
    assistant_column: str,
) -> list[dict[str, str]]:
    """Deterministically pair one human message with one assistant response."""
    human = row.get(human_column)
    assistant = row.get(assistant_column)
    if not isinstance(human, str) or not human.strip():
        raise ValueError(f"Human message field {human_column!r} must be non-empty text.")
    if not isinstance(assistant, str) or not assistant.strip():
        raise ValueError(
            f"Assistant response field {assistant_column!r} must be non-empty text."
        )
    return [
        {"from": "human", "value": human},
        {"from": "gpt", "value": assistant},
    ]


def extend_conversation_turns(
    row: dict[str, Any],
    *,
    conversations_column: str,
    human_column: str,
    assistant_column: str,
) -> Any:
    """Append exactly one new human/gpt pair onto an existing conversation list."""
    original = _decoded_list(row.get(conversations_column))
    if not isinstance(original, list):
        raise ValueError(
            f"Conversations field {conversations_column!r} must be a list."
        )
    human = row.get(human_column)
    assistant = row.get(assistant_column)
    if not isinstance(human, str) or not human.strip():
        raise ValueError(f"Human message field {human_column!r} must be non-empty text.")
    if not isinstance(assistant, str) or not assistant.strip():
        raise ValueError(
            f"Assistant response field {assistant_column!r} must be non-empty text."
        )
    merged = [dict(turn) for turn in original]
    merged.append({"from": "human", "value": human})
    merged.append({"from": "gpt", "value": assistant})
    return merged


def _invalid_assistant_content_reason(value: Any) -> str | None:
    """Return why a rewritten assistant value is unsafe, if it is unsafe."""
    if not isinstance(value, str) or not value.strip():
        return "has no non-empty visible answer"

    without_complete_tags = value.replace(_INTERNAL_THOUGHT_OPEN, "").replace(
        _INTERNAL_THOUGHT_CLOSE, ""
    )
    if (
        _INTERNAL_THOUGHT_OPEN_PREFIX in without_complete_tags
        or _INTERNAL_THOUGHT_CLOSE_PREFIX in without_complete_tags
    ):
        return "contains an incomplete internal-thought tag"

    has_open = _INTERNAL_THOUGHT_OPEN in value
    has_close = _INTERNAL_THOUGHT_CLOSE in value
    if not has_open and not has_close:
        return None

    visible_parts: list[str] = []
    cursor = 0
    inside_thoughts = False
    while cursor < len(value):
        next_open = value.find(_INTERNAL_THOUGHT_OPEN, cursor)
        next_close = value.find(_INTERNAL_THOUGHT_CLOSE, cursor)
        tag_positions = [
            position for position in (next_open, next_close) if position >= 0
        ]
        if not tag_positions:
            if not inside_thoughts:
                visible_parts.append(value[cursor:])
            break

        next_tag = min(tag_positions)
        if not inside_thoughts:
            visible_parts.append(value[cursor:next_tag])
        if next_tag == next_open:
            if inside_thoughts:
                return "contains a nested or unclosed internal-thought opening tag"
            inside_thoughts = True
            cursor = next_tag + len(_INTERNAL_THOUGHT_OPEN)
        else:
            if not inside_thoughts:
                return "contains an unmatched internal-thought closing tag"
            inside_thoughts = False
            cursor = next_tag + len(_INTERNAL_THOUGHT_CLOSE)

    if inside_thoughts:
        return "contains an unclosed internal-thought opening tag"
    if not "".join(visible_parts).strip():
        return "has no non-empty visible answer outside its internal-thought block"
    return None


def _last_assistant_turn_index(conversations: list[Any]) -> int | None:
    """Index of the last assistant/model/gpt turn, or None if there is none."""
    target: int | None = None
    for index, turn in enumerate(conversations):
        if not isinstance(turn, dict):
            continue
        role = str(turn.get("from") or "").strip().lower()
        if role in {"assistant", "model", "gpt"}:
            target = index
    return target


def validate_repair_candidate(
    row: dict[str, Any],
    *,
    uuid_column: str,
    conversations_column: str,
    candidate_column: str,
) -> dict[str, Any]:
    row_uuid = row.get(uuid_column)
    original = _decoded_list(row.get(conversations_column))
    candidate = _decoded(row.get(candidate_column))
    result = {"row_uuid": row_uuid, "valid": False, "reason": ""}
    if not isinstance(original, list):
        result["reason"] = "Original conversations value is not a list."
        return result
    if not isinstance(candidate, dict):
        result["reason"] = "Repair candidate is not a structured object."
        return result
    if candidate.get("row_uuid") != row_uuid:
        result["reason"] = "Repair candidate UUID does not match the source row."
        return result
    if candidate.get("did_rewrite") is not True:
        result["reason"] = "Repair candidate did not declare an actual rewrite."
        return result
    response = candidate.get("response")
    if not isinstance(response, str):
        result["reason"] = "Repair candidate did not supply a rewritten response."
        return result
    target_index = _last_assistant_turn_index(original)
    if target_index is None:
        result["reason"] = "Original conversations have no assistant or model turn to repair."
        return result
    if original[target_index].get("value") == response:
        result["reason"] = "Repair candidate did not change the assistant response."
        return result
    invalid_content = _invalid_assistant_content_reason(response)
    if invalid_content is not None:
        result["reason"] = (
            f"Repair candidate assistant turn {target_index} {invalid_content}."
        )
        return result
    result["valid"] = True
    result["reason"] = (
        "Candidate UUID, rewrite declaration, and assistant response are valid."
    )
    return result


def merge_approved_repair(
    row: dict[str, Any],
    *,
    uuid_column: str,
    conversations_column: str,
    candidate_column: str,
    approval_column: str,
) -> Any:
    original = _decoded_list(row.get(conversations_column))
    candidate = _decoded(row.get(candidate_column))
    approval = _decoded(row.get(approval_column))
    approved = approval is True
    if isinstance(approval, dict):
        approval_uuid = approval.get("row_uuid")
        if approval_uuid is not None and approval_uuid != row.get(uuid_column):
            return original
        approved = approval.get("approved") is True or approval.get("valid") is True
    if not approved or not isinstance(candidate, dict):
        return original
    if candidate.get("row_uuid") != row.get(uuid_column):
        return original
    checked = validate_repair_candidate(
        row,
        uuid_column = uuid_column,
        conversations_column = conversations_column,
        candidate_column = candidate_column,
    )
    if not checked["valid"]:
        return original
    target_index = _last_assistant_turn_index(original)
    if target_index is None:
        return original
    merged = [dict(turn) for turn in original]
    merged[target_index] = {**merged[target_index], "value": candidate.get("response")}
    return merged


def apply_string_replace(
    row: dict[str, Any],
    *,
    source_column: str,
    find: str,
    replace_with: str,
    use_regex: bool = False,
) -> Any:
    """Deterministically replace occurrences in one field, in place."""
    value = row.get(source_column)
    if not isinstance(value, str):
        raise ValueError(f"String replace source {source_column!r} must be text.")
    if not find:
        raise ValueError("String replace requires a non-empty find pattern.")
    if use_regex:
        import re

        try:
            pattern = re.compile(find)
        except re.error as exc:
            raise ValueError(f"String replace has an invalid regex pattern: {exc}") from exc
        return pattern.sub(replace_with, value)
    return value.replace(find, replace_with)


def split_sparse_repair_columns(
    recipe: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    columns = recipe.get("columns")
    if not isinstance(columns, list):
        return recipe, []
    regular: list[Any] = []
    sparse: list[dict[str, Any]] = []
    for column in columns:
        column_type = column.get("column_type") if isinstance(column, dict) else None
        if isinstance(column_type, str) and (
            column_type.startswith(_CONDITIONAL_PREFIX) or column_type in _REPAIR_COLUMN_TYPES
        ):
            sparse.append(dict(column))
        else:
            regular.append(column)
    if not sparse:
        return recipe, []
    return {**recipe, "columns": regular}, sparse


def _condition_is_true(template: str, row: dict[str, Any]) -> bool:
    from jinja2 import StrictUndefined
    from jinja2.sandbox import SandboxedEnvironment

    rendered = SandboxedEnvironment(undefined = StrictUndefined).from_string(template).render(**row)
    normalized = rendered.strip().lower()
    return normalized not in {"", "0", "false", "none", "null", "no", "off", "[]", "{}"}


def _make_workflow_column(spec: dict[str, Any]):
    from data_designer.config.column_configs import CustomColumnConfig
    from data_designer.config.custom_column import custom_column_generator

    name = str(spec["name"])
    column_type = str(spec["column_type"])
    if column_type == "unsloth-conversation-pair":
        human_column = _required_column_name(spec, "human_column")
        assistant_column = _required_column_name(spec, "assistant_column")
        required = [human_column, assistant_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = build_conversation_pair(
                row,
                human_column = human_column,
                assistant_column = assistant_column,
            )
            return output

    elif column_type == "unsloth-conversation-extend":
        conversations_column = _required_column_name(spec, "conversations_column")
        human_column = _required_column_name(spec, "human_column")
        assistant_column = _required_column_name(spec, "assistant_column")
        required = [conversations_column, human_column, assistant_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = extend_conversation_turns(
                row,
                conversations_column = conversations_column,
                human_column = human_column,
                assistant_column = assistant_column,
            )
            return output

    elif column_type == "unsloth-string-replace":
        source_column = _required_column_name(spec, "source_column")
        find = str(spec.get("find") or "")
        replace_with = str(spec.get("replace_with") or "")
        use_regex = bool(spec.get("use_regex", False))
        required = [source_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = apply_string_replace(
                row,
                source_column = source_column,
                find = find,
                replace_with = replace_with,
                use_regex = use_regex,
            )
            return output

    elif column_type == "unsloth-repair-tasks":
        uuid_column = _required_column_name(spec, "uuid_column")
        required = [uuid_column]
        judge_column = _required_column_name(spec, "judge_column")
        threshold = float(spec.get("threshold", 4))
        if not math.isfinite(threshold):
            raise ValueError(f"Sparse repair step {name!r} requires a finite threshold.")
        required.append(judge_column)

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = extract_repair_tasks(
                row,
                uuid_column = uuid_column,
                judge_column = judge_column,
                threshold = threshold,
            )
            return output

    elif column_type == "unsloth-repair-check":
        uuid_column = _required_column_name(spec, "uuid_column")
        required = [uuid_column]
        conversations_column = _required_column_name(spec, "conversations_column")
        candidate_column = _required_column_name(spec, "candidate_column")
        required.extend([conversations_column, candidate_column])

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = validate_repair_candidate(
                row,
                uuid_column = uuid_column,
                conversations_column = conversations_column,
                candidate_column = candidate_column,
            )
            return output

    else:
        uuid_column = _required_column_name(spec, "uuid_column")
        required = [uuid_column]
        conversations_column = _required_column_name(spec, "conversations_column")
        candidate_column = _required_column_name(spec, "candidate_column")
        approval_column = _required_column_name(spec, "approval_column")
        required.extend([conversations_column, candidate_column, approval_column])

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = merge_approved_repair(
                row,
                uuid_column = uuid_column,
                conversations_column = conversations_column,
                candidate_column = candidate_column,
                approval_column = approval_column,
            )
            return output

    return CustomColumnConfig(
        name = name,
        drop = bool(spec.get("drop", False)),
        generator_function = generate,
    )


def _make_conditional_llm_column(spec: dict[str, Any]):
    from data_designer.config.column_configs import CustomColumnConfig
    from data_designer.config.column_types import get_column_config_from_kwargs
    from data_designer.config.custom_column import custom_column_generator
    from data_designer.engine.column_generators.utils.prompt_renderer import (
        PromptType,
        RecordBasedPromptRenderer,
        create_response_recipe,
    )
    from data_designer.engine.processing.utils import deserialize_json_values

    conditional_type = str(spec["column_type"])
    llm_type = conditional_type.removeprefix(_CONDITIONAL_PREFIX)
    run_if = str(spec.get("run_if") or "").strip()
    kwargs = {
        key: value
        for key, value in spec.items()
        if key not in {"name", "column_type", "run_if", "drop"} and value is not None
    }
    llm_config = get_column_config_from_kwargs(
        name = str(spec["name"]),
        column_type = llm_type,
        drop = False,
        **kwargs,
    )
    from data_designer.config.utils.misc import extract_keywords_from_jinja2_template

    required = sorted(
        set(llm_config.required_columns)
        | set(extract_keywords_from_jinja2_template(run_if))
    )
    side_effects = list(llm_config.side_effect_columns)
    model_alias = str(llm_config.model_alias)
    response_recipes: dict[int, Any] = {}

    @custom_column_generator(
        required_columns = required,
        side_effect_columns = side_effects,
        model_aliases = [model_alias],
    )
    def generate(row, generator_params, models):
        output = dict(row)
        deserialized = deserialize_json_values(row)
        if not _condition_is_true(run_if, deserialized):
            output[llm_config.name] = None
            for side_effect in side_effects:
                output[side_effect] = None
            return output

        model = models[model_alias]
        recipe_key = id(model)
        response_recipe = response_recipes.get(recipe_key)
        if response_recipe is None:
            response_recipe = create_response_recipe(llm_config, model._model_config)
            response_recipes[recipe_key] = response_recipe
        renderer = RecordBasedPromptRenderer(
            response_recipe = response_recipe,
            error_message_context = {
                "column_name": llm_config.name,
                "column_type": llm_type,
                "model_alias": model_alias,
            },
        )
        try:
            response, trace = model.generate(
                prompt = renderer.render(
                    record = deserialized,
                    prompt_template = llm_config.prompt,
                    prompt_type = PromptType.USER_PROMPT,
                ),
                system_prompt = renderer.render(
                    record = deserialized,
                    prompt_template = llm_config.system_prompt,
                    prompt_type = PromptType.SYSTEM_PROMPT,
                ),
                parser = response_recipe.parse,
                multi_modal_context = (
                    [
                        context
                        for image_context in (llm_config.multi_modal_context or [])
                        for context in image_context.get_contexts(deserialized, base_path = None)
                    ]
                    or None
                ),
                tool_alias = llm_config.tool_alias,
                purpose = f"running conditional generation for column '{llm_config.name}'",
            )
        except Exception as exc:
            logger.warning(
                "Conditional generation failed for column %r; preserving the source row: %s",
                llm_config.name,
                exc,
            )
            output[llm_config.name] = None
            for side_effect in side_effects:
                output[side_effect] = None
            return output
        serialized = response_recipe.serialize_output(response)
        output[llm_config.name] = (
            deserialize_json_values(serialized)
            if llm_type in {"llm-structured", "llm-judge"}
            else serialized
        )
        for side_effect in side_effects:
            if side_effect.endswith("__trace"):
                if llm_config.with_trace == "last_message":
                    last_assistant = next(
                        (message for message in reversed(trace) if message.role == "assistant"),
                        None,
                    )
                    output[side_effect] = [last_assistant.to_dict()] if last_assistant else []
                else:
                    output[side_effect] = [message.to_dict() for message in trace]
            elif side_effect.endswith("__reasoning_content"):
                last_assistant = next(
                    (message for message in reversed(trace) if message.role == "assistant"),
                    None,
                )
                reasoning = getattr(last_assistant, "reasoning_content", None) if last_assistant else None
                output[side_effect] = reasoning.strip() or None if isinstance(reasoning, str) else None
        return output

    return CustomColumnConfig(
        name = llm_config.name,
        drop = bool(spec.get("drop", False)),
        generator_function = generate,
    )


def register_sparse_repair_columns(*, builder: Any, specs: list[dict[str, Any]]) -> None:
    for spec in specs:
        column_type = str(spec.get("column_type") or "")
        column = (
            _make_conditional_llm_column(spec)
            if column_type.startswith(_CONDITIONAL_PREFIX)
            else _make_workflow_column(spec)
        )
        builder.add_column(column_config = column)
