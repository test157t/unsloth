# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import json
import math
from typing import Any


_CONDITIONAL_PREFIX = "unsloth-conditional-"
_REPAIR_COLUMN_TYPES = {
    "unsloth-repair-tasks",
    "unsloth-repair-check",
    "unsloth-repair-merge",
}


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


def validate_repair_candidate(
    row: dict[str, Any],
    *,
    uuid_column: str,
    conversations_column: str,
    candidate_column: str,
) -> dict[str, Any]:
    row_uuid = row.get(uuid_column)
    original = _decoded(row.get(conversations_column))
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
    conversations = _decoded(candidate.get("conversations"))
    if not isinstance(conversations, list) or len(conversations) != len(original):
        result["reason"] = "Repair candidate changed the conversation turn count."
        return result
    changed = False
    for index, (before, after) in enumerate(zip(original, conversations, strict=True)):
        if not isinstance(before, dict) or not isinstance(after, dict):
            result["reason"] = f"Conversation turn {index} is not an object."
            return result
        if before.get("from") != after.get("from"):
            result["reason"] = f"Repair candidate changed the role at turn {index}."
            return result
        role = str(before.get("from") or "").strip().lower()
        if role not in {"assistant", "model"} and before != after:
            result["reason"] = f"Repair candidate changed protected turn {index}."
            return result
        if before != after:
            changed = True
    if not changed:
        result["reason"] = "Repair candidate did not change an assistant or model turn."
        return result
    result["valid"] = True
    result["reason"] = "Candidate UUID, roles, protected turns, and turn count are valid."
    return result


def merge_approved_repair(
    row: dict[str, Any],
    *,
    uuid_column: str,
    conversations_column: str,
    candidate_column: str,
    approval_column: str,
) -> Any:
    original = _decoded(row.get(conversations_column))
    candidate = _decoded(row.get(candidate_column))
    approval = _decoded(row.get(approval_column))
    approved = approval is True
    if isinstance(approval, dict):
        approved = approval.get("approved") is True or approval.get("valid") is True
    if not approved or not isinstance(candidate, dict):
        return original
    if candidate.get("row_uuid") != row.get(uuid_column):
        return original
    conversations = _decoded(candidate.get("conversations"))
    checked = validate_repair_candidate(
        row,
        uuid_column = uuid_column,
        conversations_column = conversations_column,
        candidate_column = candidate_column,
    )
    return conversations if checked["valid"] else original


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
    uuid_column = _required_column_name(spec, "uuid_column")
    required = [uuid_column]
    if column_type == "unsloth-repair-tasks":
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
    async def generate(row, generator_params, models):
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
        response, trace = await model.agenerate(
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
