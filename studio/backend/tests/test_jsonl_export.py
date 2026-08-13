# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "core"
    / "data_recipe"
    / "jsonl_export.py"
)
SPEC = importlib.util.spec_from_file_location("jsonl_export_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class _Frame:
    columns = ["row_uuid", "final_conversations"]

    def __len__(self) -> int:
        return 2

    def to_dict(self, *, orient: str):
        assert orient == "records"
        return [
            {"row_uuid": "a", "final_conversations": '[{"from":"assistant","value":"A"}]'},
            {"row_uuid": "b", "final_conversations": [{"from": "assistant", "value": "B"}]},
        ]


def test_jsonl_export_writes_only_the_selected_final_field_and_uuid() -> None:
    with tempfile.TemporaryDirectory() as raw_dir:
        base = Path(raw_dir)
        created = MODULE.write_jsonl_exports(
            base_dataset_path = base,
            specs = [
                {
                    "name": "final output",
                    "export_type": "jsonl",
                    "source_column": "final_conversations",
                    "output_field": "conversations",
                    "uuid_column": "row_uuid",
                    "filename": "final.jsonl",
                }
            ],
            dataframe_loader = lambda _path: _Frame(),
            make_jsonable = lambda value: value,
        )
        lines = (base / "exports" / "final.jsonl").read_text(encoding = "utf-8").splitlines()
        assert created == [{"name": "final output", "filename": "final.jsonl", "rows": 2}]
        assert [json.loads(line) for line in lines] == [
            {"conversations": [{"from": "assistant", "value": "A"}], "row_uuid": "a"},
            {"conversations": [{"from": "assistant", "value": "B"}], "row_uuid": "b"},
        ]
