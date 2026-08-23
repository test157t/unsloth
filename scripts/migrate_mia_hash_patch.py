#!/usr/bin/env python3
"""Migrate Mia rewrite/guard workflow JSON to sparse hash-addressed patches."""

from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / "Mia_Workflows"
REWRITE_PATH = WORKFLOWS / "Mia_3_Rewrite.json"
GUARD_PATH = WORKFLOWS / "Mia_4_Guard_Select.json"

ASSISTANT_EXPRESSION = "{{ conversations[-1].value }}"

PATCH_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["row_uuid", "parent_hash", "edits"],
    "properties": {
        "row_uuid": {
            "type": "string",
            "description": "Copy ROW_UUID from the input exactly.",
        },
        "parent_hash": {
            "type": "string",
            "description": "Copy PARENT_HASH from the input exactly.",
        },
        "edits": {
            "type": "array",
            "description": "Minimal ordered edits to the target assistant response.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["span", "replacement"],
                "properties": {
                    "span": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["find"],
                        "properties": {
                            "find": {
                                "type": "string",
                                "minLength": 1,
                                "description": "Exact contiguous source text to replace.",
                            },
                        },
                    },
                    "replacement": {
                        "type": "string",
                        "description": "Replacement for only the addressed span.",
                    },
                },
            },
        },
    },
}

PATCH_CONTRACT = """

HASH-ADDRESSED PATCH OUTPUT CONTRACT
This contract overrides every earlier instruction about returning a complete conversation.
- Copy ROW_UUID exactly into row_uuid.
- Copy PARENT_HASH exactly into parent_hash. Never calculate, shorten, or alter it.
- Return only edits to TARGET ASSISTANT RESPONSE. Never return conversations or unchanged surrounding text.
- Each edit.span.find must be an exact, non-empty, contiguous substring copied character-for-character from TARGET ASSISTANT RESPONSE.
- Every span must be literal and unique in the current source text. If a short phrase repeats, expand find with enough unchanged surrounding text to make it unique.
- Each replacement must contain only the text replacing that exact span.
- Edits execute sequentially. Keep them non-overlapping and order them from later source spans to earlier source spans when one edit could shift another occurrence.
- Use the fewest and smallest edits that fully repair every failed criterion.
- For a reasoning-only defect, target only text inside <Mia_Internal-Thoughts> and leave visible text untouched.
- For a visible-only defect, do not target protected hidden reasoning.
- Preserve exact quotes, newlines, tags, wrappers, Markdown, code fences, slang, and unaffected bytes outside edited spans.
- Do not include span.hash unless an exact span hash was supplied in the prompt.
- The deterministic patch node will reject stale parent hashes, missing spans, UUID mismatches, and no-op patches.
Return only the required structured patch object.
"""


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def backup(path: Path) -> Path:
    target = path.with_name(path.stem + ".pre_hash_patch.json")
    if not target.exists():
        shutil.copy2(path, target)
    return target


def migrate_rewrite(payload: dict) -> None:
    columns = payload["recipe"]["columns"]
    existing_patch = next(
        (column for column in columns if column.get("name") == "rewrite_patch"),
        None,
    )
    if existing_patch is not None:
        existing_patch["output_format"] = PATCH_SCHEMA
        existing_patch["system_prompt"] = existing_patch["system_prompt"].replace(
            "- Prefer literal spans with use_regex=false. Set occurrence to the zero-based occurrence when the same span appears more than once.",
            "- Every span must be literal and unique in the current source text. If a short phrase repeats, expand find with enough unchanged surrounding text to make it unique.",
        )
        return
    identity = next(column for column in columns if column.get("name") == "mia_identity")
    old_rewriter = next(column for column in columns if column.get("name") == "rewrite_result")

    prompt = old_rewriter["prompt"]
    prompt = prompt.replace(
        "PAIRWISE ROLE\nORIGINAL CONVERSATION is the incumbent. Produce the smallest challenger that strictly improves every FAILED CRITERION while preserving all passing behavior.",
        "PAIRWISE ROLE\nORIGINAL CONVERSATION is the incumbent. Emit the smallest hash-addressed mutation that strictly improves every FAILED CRITERION while preserving all passing behavior.\n\nTARGET ASSISTANT RESPONSE\n{{ assistant_response }}\n\nPARENT_HASH: {{ assistant_hash }}",
    )
    system_prompt = old_rewriter["system_prompt"]
    system_prompt = system_prompt.replace(
        "Return did_rewrite=true and the complete repaired conversation.\nReturn only the required structured object.",
        "Return only the required structured patch object.",
    )
    system_prompt = system_prompt + PATCH_CONTRACT

    assistant_response = {
        "column_type": "expression",
        "name": "assistant_response",
        "drop": True,
        "expr": ASSISTANT_EXPRESSION,
        "dtype": "str",
    }
    assistant_hash = {
        "name": "assistant_hash",
        "drop": True,
        "column_type": "unsloth-content-hash",
        "source_column": "assistant_response",
        "hash_length": 64,
    }
    rewrite_patch = {
        **old_rewriter,
        "name": "rewrite_patch",
        "drop": True,
        "prompt": prompt,
        "system_prompt": system_prompt,
        "output_format": PATCH_SCHEMA,
    }
    rewrite_result = {
        "name": "rewrite_result",
        "drop": False,
        "uuid_column": "row_uuid",
        "column_type": "unsloth-repair-patch",
        "source_column": "assistant_response",
        "patch_column": "rewrite_patch",
        "hash_length": 64,
    }
    payload["recipe"]["columns"] = [
        identity,
        assistant_response,
        assistant_hash,
        rewrite_patch,
        rewrite_result,
    ]

    ui = payload["ui"]
    note = next(node for node in ui["nodes"] if node.get("id") == "module_note")
    note["markdown"] = (
        "## 3 - Hash-addressed Rewrite\n\n"
        "**Input JSONL:** `row_uuid`, `conversations`, `repair_tasks`.\n\n"
        "Extracts the last assistant response, hashes its exact bytes, asks the model for minimal span edits, "
        "then applies them deterministically.\n\n"
        "**Output:** preserves seed fields and adds `rewrite_result` with `response`, `parent_hash`, "
        "`child_hash`, and applied edit metadata. This module creates candidates only; module 4 selects them."
    )
    retained = [
        node
        for node in ui["nodes"]
        if node.get("id") in {"module_note", "seed", "provider_1", "model_rewriter", "mia_identity"}
    ]
    retained.extend(
        [
            {"id": "assistant_response", "x": -150, "y": 120, "width": 400},
            {"id": "assistant_hash", "x": 350, "y": 120, "width": 400},
            {"id": "rewrite_patch", "x": 850, "y": 40, "width": 460},
            {"id": "rewrite_result", "x": 1370, "y": 40, "width": 400},
        ]
    )
    ui["nodes"] = retained
    ui["edges"] = [
        {
            "from": "provider_1",
            "to": "model_rewriter",
            "type": "semantic",
            "source_handle": "semantic-out",
            "target_handle": "semantic-in",
        },
        {
            "from": "model_rewriter",
            "to": "rewrite_patch",
            "type": "semantic",
            "source_handle": "semantic-out",
            "target_handle": "semantic-in",
        },
        *[
            {
                "from": source,
                "to": target,
                "type": "canvas",
                "source_handle": "data-out",
                "target_handle": "data-in",
            }
            for source, target in [
                ("seed", "assistant_response"),
                ("assistant_response", "assistant_hash"),
                ("seed", "rewrite_patch"),
                ("mia_identity", "rewrite_patch"),
                ("assistant_response", "rewrite_patch"),
                ("assistant_hash", "rewrite_patch"),
                ("seed", "rewrite_result"),
                ("assistant_response", "rewrite_result"),
                ("rewrite_patch", "rewrite_result"),
            ]
        ],
    ]
    ui["advanced_open_by_node"] = {
        "seed": True,
        "mia_identity": True,
        "assistant_response": True,
        "assistant_hash": True,
        "rewrite_patch": True,
        "rewrite_result": True,
    }


def migrate_guard(payload: dict) -> None:
    guard = next(
        column for column in payload["recipe"]["columns"] if column.get("name") == "rewrite_guard"
    )
    old = """CHALLENGER / REPAIR CANDIDATE
{% for turn in rewrite_result.conversations %}
--- TURN {{ loop.index0 }} ---
FROM: {{ turn.from }}
VALUE:
{{ turn.value }}
--- END TURN ---
{% endfor %}"""
    new = """CHALLENGER / REPAIR CANDIDATE
{{ rewrite_result.response }}

PATCH PROVENANCE
PARENT_HASH: {{ rewrite_result.parent_hash }}
CHILD_HASH: {{ rewrite_result.child_hash }}
EDITS:
{% for edit in rewrite_result.edits %}- FIND: {{ edit.span.find }}
  REPLACEMENT: {{ edit.replacement }}
{% endfor %}"""
    if old in guard["prompt"]:
        guard["prompt"] = guard["prompt"].replace(old, new)
    elif "{{ rewrite_result.response }}" not in guard["prompt"]:
        raise RuntimeError("Mia 4 guard prompt has neither old nor migrated candidate contract")
    note = next(node for node in payload["ui"]["nodes"] if node.get("id") == "module_note")
    note["markdown"] = note["markdown"].replace(
        "`rewrite_result`.",
        "hash-addressed `rewrite_result` candidate metadata.",
    )


def validate(rewrite: dict, guard: dict) -> None:
    columns = {column["name"]: column for column in rewrite["recipe"]["columns"]}
    assert list(columns) == [
        "mia_identity",
        "assistant_response",
        "assistant_hash",
        "rewrite_patch",
        "rewrite_result",
    ]
    assert columns["assistant_hash"]["source_column"] == "assistant_response"
    assert columns["rewrite_result"]["source_column"] == "assistant_response"
    assert columns["rewrite_result"]["patch_column"] == "rewrite_patch"
    assert columns["rewrite_patch"]["output_format"] == PATCH_SCHEMA
    assert "{{ assistant_hash }}" in columns["rewrite_patch"]["prompt"]
    assert "HASH-ADDRESSED PATCH OUTPUT CONTRACT" in columns["rewrite_patch"]["system_prompt"]

    guard_columns = {column["name"]: column for column in guard["recipe"]["columns"]}
    assert guard_columns["repair_check"]["candidate_column"] == "rewrite_result"
    assert guard_columns["final_conversations"]["candidate_column"] == "rewrite_result"
    assert "{{ rewrite_result.response }}" in guard_columns["rewrite_guard"]["prompt"]
    assert "rewrite_result.conversations" not in guard_columns["rewrite_guard"]["prompt"]


def main() -> None:
    rewrite = load(REWRITE_PATH)
    guard = load(GUARD_PATH)
    rewrite_backup = backup(REWRITE_PATH)
    guard_backup = backup(GUARD_PATH)
    migrate_rewrite(rewrite)
    migrate_guard(guard)
    validate(rewrite, guard)
    save(REWRITE_PATH, rewrite)
    save(GUARD_PATH, guard)
    print(f"Updated {REWRITE_PATH}")
    print(f"Updated {GUARD_PATH}")
    print(f"Backups: {rewrite_backup}, {guard_backup}")


if __name__ == "__main__":
    main()
