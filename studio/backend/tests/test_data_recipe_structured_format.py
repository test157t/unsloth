# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import sys
from pathlib import Path


_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from routes.data_recipe.jobs import _inject_local_structured_response_format


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
