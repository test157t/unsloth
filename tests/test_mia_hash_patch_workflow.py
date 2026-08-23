from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path

from jinja2.sandbox import ImmutableSandboxedEnvironment


ROOT = Path(__file__).resolve().parent.parent


def _load_sparse_module():
    path = ROOT / "studio/backend/core/data_recipe/sparse_repair_steps.py"
    spec = importlib.util.spec_from_file_location("mia_sparse_repair_steps", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_assistant_extraction_hash_and_patch_contract():
    payload = json.loads((ROOT / "Mia_Workflows/Mia_3_Rewrite.json").read_text(encoding="utf-8"))
    columns = {column["name"]: column for column in payload["recipe"]["columns"]}
    environment = ImmutableSandboxedEnvironment()
    rendered = environment.from_string(columns["assistant_response"]["expr"]).render(
        conversations=[
            {"from": "human", "value": "Question"},
            {"from": "assistant", "value": "Latest answer"},
        ]
    )
    assert rendered == "Latest answer"

    sparse = _load_sparse_module()
    parent_hash = sparse.compute_content_hash(
        {"assistant_response": rendered}, source_column="assistant_response"
    )
    patch = {
        "row_uuid": "row-1",
        "parent_hash": parent_hash,
        "edits": [{"span": {"find": "Latest"}, "replacement": "Improved"}],
    }
    result = sparse.apply_repair_patch(
        {
            "row_uuid": "row-1",
            "assistant_response": rendered,
            "rewrite_patch": patch,
        },
        uuid_column="row_uuid",
        source_column="assistant_response",
        patch_column="rewrite_patch",
    )
    assert result["valid"] is True
    assert result["response"] == "Improved answer"
    assert result["parent_hash"] == parent_hash
    assert result["child_hash"] != parent_hash


def test_mia_rewrite_builds_with_data_designer():
    backend = ROOT / "studio/backend"
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))
    from core.data_recipe.service import build_config_builder, create_data_designer

    payload = json.loads((ROOT / "Mia_Workflows/Mia_3_Rewrite.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as directory:
        seed = Path(directory) / "seed.jsonl"
        seed.write_text(
            json.dumps(
                {
                    "row_uuid": "row-1",
                    "conversations": [
                        {"from": "human", "value": "Question"},
                        {"from": "gpt", "value": "Answer"},
                    ],
                    "repair_tasks": {"row_uuid": "row-1", "repairs": []},
                }
            )
            + "\n",
            encoding="utf-8",
        )
        payload["recipe"]["seed_config"]["source"]["path"] = str(seed)
        payload["recipe"]["seed_config"].pop("resolved_paths", None)
        payload["recipe"]["seed_config"]["selection_strategy"] = None
        next(
            column
            for column in payload["recipe"]["columns"]
            if column["name"] == "assistant_response"
        )["drop"] = False
        provider = payload["recipe"]["model_providers"][0]
        provider.pop("is_local", None)
        provider["endpoint"] = "http://127.0.0.1:1/v1"
        provider["api_key"] = "test-key"
        payload["recipe"]["model_configs"][0]["skip_health_check"] = True
        builder = build_config_builder(payload["recipe"])
        designer = create_data_designer(payload["recipe"])
        designer.validate(builder)
        preview = designer.preview(builder, num_records=1)

    assert builder is not None
    assert preview.dataset["assistant_response"].iloc[0] == "Answer"
