# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import hashlib
import json
import logging
import math
from typing import Any


_CONDITIONAL_PREFIX = "unsloth-conditional-"
_REPAIR_COLUMN_TYPES = {
    "unsloth-conversation-pair",
    "unsloth-conversation-extend",
    "unsloth-agent-conversation",
    "unsloth-agent-conversation-strip-reasoning",
    "unsloth-agent-conversation-extend",
    "unsloth-agent-conversation-project",
    "unsloth-repair-tasks",
    "unsloth-repair-check",
    "unsloth-repair-merge",
    "unsloth-string-replace",
    "unsloth-content-hash",
    "unsloth-repair-patch",
}
DEFAULT_INTERNAL_THOUGHT_TAG = "Internal-Thoughts"

logger = logging.getLogger(__name__)


def _internal_thought_tokens(
    tag: str,
) -> tuple[str, str, str, str]:
    """Expand a reasoning-tag name into open, close, and prefix strings.

    An empty tag falls back to the generic default so existing workflows keep
    their reasoning-tag validation without an explicit value.
    """
    name = tag.strip() or DEFAULT_INTERNAL_THOUGHT_TAG
    return f"<{name}>", f"</{name}>", f"<{name}", f"</{name}"


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
    internal_thought_tag: str = "",
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
    _require_single_internal_thought_block(
        assistant,
        internal_thought_tag,
        context = f"Assistant response field {assistant_column!r}",
    )
    return [
        {"from": "human", "value": human},
        {"from": "gpt", "value": assistant},
    ]


def _message_text_content(content: Any, *, context: str) -> str:
    """Normalize string or structured OpenAI text content without silent loss."""

    if content is None:
        return ""
    if isinstance(content, str):
        return content
    raw_blocks = content if isinstance(content, list) else [content]
    parts: list[str] = []
    for raw_block in raw_blocks:
        block = _decoded(raw_block)
        if isinstance(block, str):
            parts.append(block)
            continue
        if not isinstance(block, dict):
            raise ValueError(f"{context} contains a malformed content block.")
        block_type = str(block.get("type") or "").strip().lower()
        text = block.get("text")
        if isinstance(text, str) and block_type in {"", "text", "input_text", "output_text"}:
            parts.append(text)
            continue
        raise ValueError(
            f"{context} contains unsupported non-text content block type {block_type!r}."
        )
    return "".join(parts)


def build_agent_conversation(
    row: dict[str, Any],
    *,
    human_column: str,
    trace_column: str,
    internal_thought_tag: str = "",
) -> list[dict[str, Any]]:
    """Build an OpenAI-style user/tool/assistant training conversation.

    Data Designer traces include the orchestration system and user prompts used
    to generate a column.  Those are deliberately excluded: the training user
    turn must be the natural message, while assistant tool calls, tool results,
    and the final assistant response are preserved exactly.
    """

    human = row.get(human_column)
    trace = _decoded_list(row.get(trace_column))
    if not isinstance(human, str) or not human.strip():
        raise ValueError(f"Human message field {human_column!r} must be non-empty text.")
    if not isinstance(trace, list):
        raise ValueError(f"Trace field {trace_column!r} must be a message list.")

    messages: list[dict[str, Any]] = [{"role": "user", "content": human}]
    call_ids: set[str] = set()
    result_ids: set[str] = set()

    for raw_message in trace:
        message = _decoded(raw_message)
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "").strip().lower()
        if role == "assistant":
            raw_calls = message.get("tool_calls")
            tool_calls = raw_calls if isinstance(raw_calls, list) else []
            content_text = _message_text_content(
                message.get("content"),
                context = "Assistant trace",
            )
            if tool_calls:
                normalized_calls: list[dict[str, Any]] = []
                for raw_call in tool_calls:
                    call = _decoded(raw_call)
                    if not isinstance(call, dict):
                        raise ValueError("Assistant trace contains a malformed tool call.")
                    call_id = str(call.get("id") or "").strip()
                    function = call.get("function")
                    if not call_id or not isinstance(function, dict):
                        raise ValueError("Assistant trace tool calls require id and function.")
                    name = str(function.get("name") or "").strip()
                    arguments = function.get("arguments")
                    if not name or not isinstance(arguments, str):
                        raise ValueError("Assistant trace tool functions require name and JSON arguments.")
                    if call_id in call_ids:
                        raise ValueError(f"Agent trace repeats tool call id {call_id!r}.")
                    call_ids.add(call_id)
                    normalized_calls.append(
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {"name": name, "arguments": arguments},
                        }
                    )
                assistant_message: dict[str, Any] = {
                    "role": "assistant",
                    "content": content_text,
                    "tool_calls": normalized_calls,
                }
                messages.append(assistant_message)
            elif content_text.strip():
                messages.append({"role": "assistant", "content": content_text})
        elif role == "tool":
            call_id = str(message.get("tool_call_id") or "").strip()
            content_text = _message_text_content(
                message.get("content"),
                context = "Tool trace",
            )
            if not call_id:
                raise ValueError("Tool trace messages require tool_call_id and text content.")
            if call_id in result_ids:
                raise ValueError(f"Agent trace repeats tool result id {call_id!r}.")
            result_ids.add(call_id)
            messages.append(
                {"role": "tool", "content": content_text, "tool_call_id": call_id}
            )

    if messages[-1].get("role") != "assistant" or messages[-1].get("tool_calls"):
        raise ValueError("Agent trace must end with a non-empty assistant response.")
    _require_single_internal_thought_block(
        messages[-1].get("content"),
        internal_thought_tag,
        context = "Final assistant trace response",
    )
    missing_results = call_ids.difference(result_ids)
    orphan_results = result_ids.difference(call_ids)
    if missing_results:
        raise ValueError(f"Agent trace is missing tool results for {sorted(missing_results)!r}.")
    if orphan_results:
        raise ValueError(f"Agent trace has orphan tool results for {sorted(orphan_results)!r}.")
    return messages


def extend_agent_conversation(
    row: dict[str, Any],
    *,
    messages_column: str,
    human_column: str,
    trace_column: str,
    internal_thought_tag: str = "",
) -> list[dict[str, Any]]:
    """Append one natural user turn and its complete agent trace to a history.

    The input is deliberately OpenAI-style only.  This keeps one canonical
    recursive representation and prevents an apparently successful extension
    from silently discarding older tool calls stored in a different schema.
    """

    original = _decoded_list(row.get(messages_column))
    if not isinstance(original, list):
        raise ValueError(f"Agent messages field {messages_column!r} must be a list.")
    history: list[dict[str, Any]] = []
    existing_call_ids: set[str] = set()
    outstanding_call_ids: set[str] = set()
    for index, raw_message in enumerate(original):
        message = _decoded(raw_message)
        if not isinstance(message, dict):
            raise ValueError(f"Agent message {index} must be an object.")
        role = str(message.get("role") or "").strip().lower()
        if role not in {"system", "user", "assistant", "tool"}:
            raise ValueError(f"Agent message {index} has unsupported role {role!r}.")
        if "from" in message or "value" in message:
            raise ValueError(
                "Multi-turn agent history must use role/content messages, not ShareGPT turns."
            )
        copied = dict(message)
        copied["role"] = role
        raw_calls = copied.get("tool_calls")
        if role == "assistant" and isinstance(raw_calls, list):
            for raw_call in raw_calls:
                call = _decoded(raw_call)
                function = call.get("function") if isinstance(call, dict) else None
                call_id = str(call.get("id") or "").strip() if isinstance(call, dict) else ""
                if (
                    not call_id
                    or not isinstance(function, dict)
                    or not str(function.get("name") or "").strip()
                    or not isinstance(function.get("arguments"), str)
                ):
                    raise ValueError(f"Agent message {index} has a malformed tool call.")
                if call_id in outstanding_call_ids:
                    raise ValueError(f"Agent history repeats unresolved tool call id {call_id!r}.")
                existing_call_ids.add(call_id)
                outstanding_call_ids.add(call_id)
        elif role == "tool":
            call_id = str(copied.get("tool_call_id") or "").strip()
            if not call_id or not isinstance(copied.get("content"), str):
                raise ValueError(f"Agent tool message {index} is malformed.")
            if call_id not in outstanding_call_ids:
                raise ValueError(f"Agent history has orphan tool result {call_id!r}.")
            outstanding_call_ids.remove(call_id)
        history.append(copied)

    if outstanding_call_ids:
        raise ValueError(
            f"Agent history is missing tool results for {sorted(outstanding_call_ids)!r}."
        )
    if (
        not history
        or history[-1].get("role") != "assistant"
        or history[-1].get("tool_calls")
        or not isinstance(history[-1].get("content"), str)
        or not history[-1]["content"].strip()
    ):
        raise ValueError("Agent history must end with a non-empty assistant response.")

    tail = build_agent_conversation(
        row,
        human_column = human_column,
        trace_column = trace_column,
        internal_thought_tag = internal_thought_tag,
    )

    # Some providers restart call ids on each generation.  Keep the trace
    # internally paired while making ids unique across the recursive history.
    remapped_ids: dict[str, str] = {}
    prefix = f"turn-{sum(1 for message in history if message.get('role') == 'user') + 1}-"
    for message in tail:
        calls = message.get("tool_calls")
        if not isinstance(calls, list):
            continue
        for call in calls:
            call_id = str(call.get("id") or "").strip()
            candidate = call_id
            suffix = 1
            while candidate in existing_call_ids:
                candidate = f"{prefix}{call_id}-{suffix}"
                suffix += 1
            existing_call_ids.add(candidate)
            if candidate != call_id:
                remapped_ids[call_id] = candidate
                call["id"] = candidate
    if remapped_ids:
        for message in tail:
            if message.get("role") == "tool":
                call_id = str(message.get("tool_call_id") or "")
                if call_id in remapped_ids:
                    message["tool_call_id"] = remapped_ids[call_id]

    return history + tail


def project_agent_conversation(
    row: dict[str, Any],
    *,
    messages_column: str,
) -> list[dict[str, str]]:
    """Project natural user and final assistant turns for legacy judges.

    Tool-call carrier messages and tool results remain in the canonical agent
    history.  The projection intentionally excludes them so stages 2-4 can
    retain their existing ShareGPT contracts without learning fake tool prose.
    """

    original = _decoded_list(row.get(messages_column))
    if not isinstance(original, list):
        raise ValueError(f"Agent messages field {messages_column!r} must be a list.")
    projected: list[dict[str, str]] = []
    for index, raw_message in enumerate(original):
        message = _decoded(raw_message)
        if not isinstance(message, dict):
            raise ValueError(f"Agent message {index} must be an object.")
        role = str(message.get("role") or "").strip().lower()
        content = message.get("content")
        if role == "user" and isinstance(content, str) and content.strip():
            projected.append({"from": "human", "value": content})
        elif (
            role == "assistant"
            and not message.get("tool_calls")
            and isinstance(content, str)
            and content.strip()
        ):
            projected.append({"from": "gpt", "value": content})
    if not projected or projected[-1].get("from") != "gpt":
        raise ValueError("Projected agent history must end with a final assistant response.")
    return projected


def _strip_reasoning_blocks(value: str, internal_thought_tag: str) -> str:
    """Remove complete reasoning blocks while rejecting malformed tag structure."""

    open_tag, close_tag, open_prefix, close_prefix = _internal_thought_tokens(
        internal_thought_tag
    )
    if open_prefix not in value and close_prefix not in value:
        return value

    visible: list[str] = []
    cursor = 0
    while cursor < len(value):
        next_open = value.find(open_tag, cursor)
        next_close = value.find(close_tag, cursor)
        if next_close >= 0 and (next_open < 0 or next_close < next_open):
            raise ValueError("Assistant history contains an unmatched reasoning close tag.")
        if next_open < 0:
            remainder = value[cursor:]
            if open_prefix in remainder or close_prefix in remainder:
                raise ValueError("Assistant history contains an incomplete reasoning tag.")
            visible.append(remainder)
            break

        visible.append(value[cursor:next_open])
        reasoning_start = next_open + len(open_tag)
        next_nested_open = value.find(open_tag, reasoning_start)
        block_end = value.find(close_tag, reasoning_start)
        if block_end < 0:
            raise ValueError("Assistant history contains an unclosed reasoning block.")
        if next_nested_open >= 0 and next_nested_open < block_end:
            raise ValueError("Assistant history contains a nested reasoning block.")
        cursor = block_end + len(close_tag)

    return "".join(visible).strip()


def strip_agent_conversation_reasoning(
    row: dict[str, Any],
    *,
    messages_column: str,
    internal_thought_tag: str,
    conversations_column: str = "",
) -> list[dict[str, Any]]:
    """Normalize history and remove reasoning blocks from assistant content.

    Canonical OpenAI-style messages win whenever that field is present. A
    ShareGPT conversation fallback lets ordinary 1A exports enter the same 1B
    pipeline without fabricating tool traces or maintaining a second path.
    """

    if messages_column in row:
        original = _decoded_list(row.get(messages_column))
    elif conversations_column and conversations_column in row:
        conversations = _decoded_list(row.get(conversations_column))
        if not isinstance(conversations, list):
            raise ValueError(
                f"Conversations field {conversations_column!r} must be a list."
            )
        original = []
        role_map = {
            "human": "user",
            "user": "user",
            "gpt": "assistant",
            "assistant": "assistant",
        }
        for index, raw_turn in enumerate(conversations):
            turn = _decoded(raw_turn)
            if not isinstance(turn, dict):
                raise ValueError(f"Conversation turn {index} must be an object.")
            source_role = str(turn.get("from") or "").strip().lower()
            role = role_map.get(source_role)
            if role is None:
                raise ValueError(
                    f"Conversation turn {index} has unsupported role {source_role!r}."
                )
            content = turn.get("value")
            if not isinstance(content, str):
                raise ValueError(f"Conversation turn {index} value must be text.")
            original.append({"role": role, "content": content})
    else:
        accepted = repr(messages_column)
        if conversations_column:
            accepted += f" or {conversations_column!r}"
        raise ValueError(f"History requires field {accepted}.")

    if not isinstance(original, list):
        raise ValueError(f"Agent messages field {messages_column!r} must be a list.")
    cleaned: list[dict[str, Any]] = []
    for index, raw_message in enumerate(original):
        message = _decoded(raw_message)
        if not isinstance(message, dict):
            raise ValueError(f"Agent message {index} must be an object.")
        copied = dict(message)
        role = str(copied.get("role") or "").strip().lower()
        copied["role"] = role
        if role == "assistant":
            content = copied.get("content")
            if content is not None and not isinstance(content, str):
                raise ValueError(f"Assistant message {index} content must be text.")
            if isinstance(content, str):
                copied["content"] = _strip_reasoning_blocks(
                    content,
                    internal_thought_tag,
                )
        cleaned.append(copied)

    if (
        not cleaned
        or cleaned[-1].get("role") != "assistant"
        or not isinstance(cleaned[-1].get("content"), str)
        or not cleaned[-1]["content"].strip()
    ):
        raise ValueError(
            "Cleaned agent history must end with a non-empty visible assistant response."
        )
    return cleaned


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


def _invalid_assistant_content_reason(
    value: Any,
    internal_thought_tag: str,
) -> str | None:
    """Return why a rewritten assistant value is unsafe, if it is unsafe."""
    if not isinstance(value, str) or not value.strip():
        return "has no non-empty visible answer"

    (
        open_tag,
        close_tag,
        open_prefix,
        close_prefix,
    ) = _internal_thought_tokens(internal_thought_tag)
    without_complete_tags = value.replace(open_tag, "").replace(close_tag, "")
    if open_prefix in without_complete_tags or close_prefix in without_complete_tags:
        return "contains an incomplete internal-thought tag"

    has_open = open_tag in value
    has_close = close_tag in value
    if not has_open and not has_close:
        return None

    visible_parts: list[str] = []
    cursor = 0
    inside_thoughts = False
    while cursor < len(value):
        next_open = value.find(open_tag, cursor)
        next_close = value.find(close_tag, cursor)
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
            cursor = next_tag + len(open_tag)
        else:
            if not inside_thoughts:
                return "contains an unmatched internal-thought closing tag"
            inside_thoughts = False
            cursor = next_tag + len(close_tag)

    if inside_thoughts:
        return "contains an unclosed internal-thought opening tag"
    if not "".join(visible_parts).strip():
        return "has no non-empty visible answer outside its internal-thought block"
    return None


def _require_single_internal_thought_block(
    value: Any,
    internal_thought_tag: str,
    *,
    context: str,
) -> None:
    """Require one exact reasoning block when a workflow opts into a tag."""
    tag = internal_thought_tag.strip()
    if not tag:
        return
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} must be non-empty text.")

    open_tag, close_tag, _, _ = _internal_thought_tokens(tag)
    lowered = value.lower()
    if (
        lowered.count(open_tag.lower()) != 1
        or lowered.count(close_tag.lower()) != 1
    ):
        raise ValueError(
            f"{context} must contain exactly one <{tag}>...</{tag}> block."
        )
    if value.count(open_tag) != 1 or value.count(close_tag) != 1:
        raise ValueError(
            f"{context} must use the exact case-sensitive <{tag}>...</{tag}> tags."
        )
    if not value.lstrip().startswith(open_tag):
        raise ValueError(f"{context} must begin with {open_tag}.")

    invalid_reason = _invalid_assistant_content_reason(value, tag)
    if invalid_reason is not None:
        raise ValueError(f"{context} {invalid_reason}.")


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
    internal_thought_tag: str = "",
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
    invalid_content = _invalid_assistant_content_reason(
        response,
        internal_thought_tag,
    )
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
    internal_thought_tag: str = "",
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
        internal_thought_tag = internal_thought_tag,
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


def _content_digest(value: Any, hash_length: int) -> str:
    """Stable sha256 hex digest of one cell's canonical text, optionally truncated."""
    if isinstance(value, str):
        raw = value
    else:
        try:
            raw = json.dumps(
                value,
                sort_keys = True,
                ensure_ascii = False,
                separators = (",", ":"),
                default = str,
            )
        except (TypeError, ValueError):
            raw = repr(value)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    if hash_length and hash_length < len(digest):
        return digest[:hash_length]
    return digest


def compute_content_hash(
    row: dict[str, Any],
    *,
    source_column: str,
    hash_length: int = 64,
) -> str:
    """Stable content hash of one cell, addressable as a row-agnostic block id."""
    return _content_digest(row.get(source_column), hash_length)


def _replace_occurrence(
    value: str,
    find: str,
    use_regex: bool,
    occurrence: int,
) -> tuple[int, int, str] | None:
    """Locate one span in ``value`` for hashing and splicing.

    Returns ``(start, end, matched_block)`` where ``value[start:end]`` is exactly
    the located block (so span hashes can be verified against the block text), or
    ``None`` when the occurrence does not exist.
    """
    if use_regex:
        import re

        try:
            pattern = re.compile(find)
        except re.error as exc:
            raise ValueError(f"Repair patch has an invalid regex pattern: {exc}") from exc
        count = 0
        for match in pattern.finditer(value):
            if match.start() == match.end():
                continue
            if count == occurrence:
                block = match.group(0)
                return match.start(), match.end(), block
            count += 1
        return None
    pos = -1
    for _ in range(occurrence + 1):
        pos = value.find(find, pos + 1)
        if pos < 0:
            return None
    return pos, pos + len(find), find


def apply_repair_patch(
    row: dict[str, Any],
    *,
    uuid_column: str,
    source_column: str,
    patch_column: str,
    hash_length: int = 64,
) -> dict[str, Any]:
    """Apply a hash-aware, structured patch to one text cell.

    The patch targets the row UUID plus the source/parent hash and zero or more
    hash-addressed blocks. Each edit only supplies replacement content; the
    deterministic node stitches the result and hashes it, so the model never has
    to re-emit the surrounding text. The patch, parent hash, and child hash are
    preserved in the returned object as dataset metadata.
    """
    source = row.get(source_column)
    patch = _decoded(row.get(patch_column))
    row_uuid = row.get(uuid_column)
    result = {"row_uuid": row_uuid}
    if not isinstance(source, str):
        result["valid"] = False
        result["reason"] = "Repair patch source must be text."
        return result
    if not isinstance(patch, dict):
        result["valid"] = False
        result["reason"] = "Repair patch is not a structured object."
        return result
    if patch.get("row_uuid") != row_uuid:
        result["valid"] = False
        result["reason"] = "Repair patch UUID does not match the source row."
        return result
    parent_hash = _content_digest(source, hash_length)
    if patch.get("parent_hash") and patch["parent_hash"] != parent_hash:
        result["valid"] = False
        result["reason"] = "Repair patch parent hash does not match the source content."
        return result
    edits = patch.get("edits")
    if not isinstance(edits, list) or not edits:
        result["valid"] = False
        result["reason"] = "Repair patch supplied no edits."
        return result
    value = source
    for index, edit in enumerate(edits):
        if not isinstance(edit, dict):
            result["valid"] = False
            result["reason"] = f"Repair patch edit {index} is not an object."
            return result
        span = edit.get("span")
        if not isinstance(span, dict):
            result["valid"] = False
            result["reason"] = f"Repair patch edit {index} has no span."
            return result
        find = span.get("find")
        if not isinstance(find, str) or not find:
            result["valid"] = False
            result["reason"] = f"Repair patch edit {index} has no find pattern."
            return result
        replacement = edit.get("replacement")
        if not isinstance(replacement, str):
            result["valid"] = False
            result["reason"] = f"Repair patch edit {index} has no replacement content."
            return result
        use_regex = bool(span.get("use_regex", False))
        occurrence = int(span.get("occurrence", 0) or 0)
        try:
            located = _replace_occurrence(value, find, use_regex, occurrence)
        except ValueError as exc:
            result["valid"] = False
            result["reason"] = str(exc)
            return result
        if located is None:
            result["valid"] = False
            result["reason"] = f"Repair patch edit {index} did not find its span."
            return result
        start, end, block_text = located
        span_hash = span.get("hash")
        if span_hash and _content_digest(block_text, hash_length) != span_hash:
            result["valid"] = False
            result["reason"] = f"Repair patch edit {index} span hash does not match its content."
            return result
        value = value[:start] + replacement + value[end:]
    if value == source:
        result["valid"] = False
        result["reason"] = "Repair patch did not change the source content."
        return result
    result["valid"] = True
    result["did_rewrite"] = True
    result["response"] = value
    result["parent_hash"] = parent_hash
    result["child_hash"] = _content_digest(value, hash_length)
    result["patched"] = True
    result["edits"] = edits
    result["reason"] = "Repair patch applied with matching parent and child hashes."
    return result


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
        internal_thought_tag = str(spec.get("internal_thought_tag") or "").strip()
        required = [human_column, assistant_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = build_conversation_pair(
                row,
                human_column = human_column,
                assistant_column = assistant_column,
                internal_thought_tag = internal_thought_tag,
            )
            return output

    elif column_type == "unsloth-agent-conversation":
        human_column = _required_column_name(spec, "human_column")
        trace_column = _required_column_name(spec, "trace_column")
        internal_thought_tag = str(spec.get("internal_thought_tag") or "").strip()
        required = [human_column, trace_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = build_agent_conversation(
                row,
                human_column = human_column,
                trace_column = trace_column,
                internal_thought_tag = internal_thought_tag,
            )
            return output

    elif column_type == "unsloth-agent-conversation-strip-reasoning":
        messages_column = _required_column_name(spec, "messages_column")
        conversations_column = str(spec.get("conversations_column") or "").strip()
        internal_thought_tag = str(
            spec.get("internal_thought_tag") or "Mia_Internal-Thoughts"
        ).strip()
        required = [] if conversations_column else [messages_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = strip_agent_conversation_reasoning(
                row,
                messages_column = messages_column,
                internal_thought_tag = internal_thought_tag,
                conversations_column = conversations_column,
            )
            return output

    elif column_type == "unsloth-agent-conversation-extend":
        messages_column = _required_column_name(spec, "messages_column")
        human_column = _required_column_name(spec, "human_column")
        trace_column = _required_column_name(spec, "trace_column")
        internal_thought_tag = str(spec.get("internal_thought_tag") or "").strip()
        required = [messages_column, human_column, trace_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = extend_agent_conversation(
                row,
                messages_column = messages_column,
                human_column = human_column,
                trace_column = trace_column,
                internal_thought_tag = internal_thought_tag,
            )
            return output

    elif column_type == "unsloth-agent-conversation-project":
        messages_column = _required_column_name(spec, "messages_column")
        required = [messages_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = project_agent_conversation(
                row,
                messages_column = messages_column,
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

    elif column_type == "unsloth-content-hash":
        source_column = _required_column_name(spec, "source_column")
        hash_length = int(spec.get("hash_length") or 64)
        required = [source_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = compute_content_hash(
                row,
                source_column = source_column,
                hash_length = hash_length,
            )
            return output

    elif column_type == "unsloth-repair-patch":
        uuid_column = _required_column_name(spec, "uuid_column")
        source_column = _required_column_name(spec, "source_column")
        patch_column = _required_column_name(spec, "patch_column")
        hash_length = int(spec.get("hash_length") or 64)
        required = [uuid_column, source_column, patch_column]

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = apply_repair_patch(
                row,
                uuid_column = uuid_column,
                source_column = source_column,
                patch_column = patch_column,
                hash_length = hash_length,
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
        internal_thought_tag = str(spec.get("internal_thought_tag") or "")
        required.extend([conversations_column, candidate_column])

        @custom_column_generator(required_columns = required)
        def generate(row):
            output = dict(row)
            output[name] = validate_repair_candidate(
                row,
                uuid_column = uuid_column,
                conversations_column = conversations_column,
                candidate_column = candidate_column,
                internal_thought_tag = internal_thought_tag,
            )
            return output

    else:
        uuid_column = _required_column_name(spec, "uuid_column")
        required = [uuid_column]
        conversations_column = _required_column_name(spec, "conversations_column")
        candidate_column = _required_column_name(spec, "candidate_column")
        approval_column = _required_column_name(spec, "approval_column")
        internal_thought_tag = str(spec.get("internal_thought_tag") or "")
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
                internal_thought_tag = internal_thought_tag,
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
