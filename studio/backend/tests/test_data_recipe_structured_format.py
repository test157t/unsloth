# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import sys
from pathlib import Path


_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import routes.data_recipe.jobs as jobs_route
from routes.data_recipe.jobs import (
    _bind_local_model_variants,
    _ensure_selected_local_model_loaded,
    _inject_local_structured_response_format,
)


def test_local_structured_recipe_uses_openai_json_schema_envelope():
    schema = {
        "type": "object",
        "required": ["row_uuid"],
        "properties": {"row_uuid": {"type": "string"}},
    }
    recipe = {
        "model_providers": [{"name": "local", "is_local": True}],
        "model_configs": [
            {"alias": "rewriter", "model": "repo/model", "provider": "local"}
        ],
        "columns": [
            {
                "column_type": "unsloth-conditional-llm-structured",
                "name": "rewrite_patch",
                "model_alias": "rewriter",
                "output_format": schema,
            }
        ],
    }

    _inject_local_structured_response_format(recipe, {"local"})

    column = recipe["columns"][0]
    assert column["model_alias"] == "rewriter__rewrite_patch_structured"
    clone = recipe["model_configs"][1]
    response_format = clone["inference_parameters"]["extra_body"]["response_format"]
    assert response_format == {
        "type": "json_schema",
        "json_schema": {
            "name": "rewrite_patch",
            "strict": True,
            "schema": schema,
        },
    }
    assert "schema" not in response_format


def test_local_model_variants_are_carried_in_actual_request_model_ids():
    recipe = {
        "model_configs": [
            {
                "alias": "human_generator",
                "model": "TrevorJS/gemma-4-26B-A4B-it-uncensored-GGUF",
                "gguf_variant": "Q4_K_M",
                "provider": "local",
            },
            {
                "alias": "mia_generator",
                "model": "TrevorJS/gemma-4-31B-it-uncensored-GGUF",
                "gguf_variant": "Q4_K_M",
                "provider": "local",
            },
        ],
        "columns": [
            {
                "column_type": "llm-text",
                "name": "human_message",
                "model_alias": "human_generator",
            },
            {
                "column_type": "llm-text",
                "name": "mia_response",
                "model_alias": "mia_generator",
            },
        ],
    }

    _bind_local_model_variants(recipe, {"local"})

    assert recipe["model_configs"][0]["model"].endswith(":Q4_K_M")
    assert recipe["model_configs"][1]["model"].endswith(":Q4_K_M")


def test_any_selected_local_model_can_start_a_multi_model_recipe(monkeypatch):
    recipe = {
        "model_configs": [
            {
                "alias": "human_generator",
                "model": "org/human-GGUF",
                "gguf_variant": "Q4_K_M",
                "provider": "local",
            },
            {
                "alias": "mia_generator",
                "model": "org/mia-GGUF",
                "gguf_variant": "Q4_K_M",
                "provider": "local",
            },
        ],
        "columns": [
            {
                "column_type": "llm-text",
                "name": "human_message",
                "model_alias": "human_generator",
            },
            {
                "column_type": "llm-text",
                "name": "mia_response",
                "model_alias": "mia_generator",
            },
        ],
    }
    monkeypatch.setattr(
        jobs_route,
        "_loaded_local_model_identity",
        lambda: (True, "org/human-GGUF", "Q4_K_M"),
    )

    _ensure_selected_local_model_loaded(recipe, {"local"})
