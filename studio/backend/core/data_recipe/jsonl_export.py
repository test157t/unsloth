# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable


def _decoded_json_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value


def write_jsonl_exports(
    *,
    base_dataset_path: Path,
    specs: Any,
    dataframe_loader: Callable[[Path], Any] | None = None,
    make_jsonable: Callable[[Any], Any] | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(specs, list) or not specs:
        return []
    if dataframe_loader is None:
        from data_designer.config.utils.io_helpers import read_parquet_dataset

        dataframe_loader = read_parquet_dataset
    if make_jsonable is None:
        from .jsonable import to_jsonable

        make_jsonable = to_jsonable

    dataframe = dataframe_loader(base_dataset_path / "parquet-files")
    available_columns = set(str(column) for column in dataframe.columns)
    export_dir = base_dataset_path / "exports"
    export_dir.mkdir(parents = True, exist_ok = True)
    created: list[dict[str, Any]] = []
    seen_filenames: set[str] = set()
    for raw_spec in specs:
        if not isinstance(raw_spec, dict) or raw_spec.get("export_type") != "jsonl":
            continue
        name = str(raw_spec.get("name") or "JSONL export").strip()
        source_column = str(raw_spec.get("source_column") or "").strip()
        output_field = str(raw_spec.get("output_field") or "").strip()
        uuid_column = str(raw_spec.get("uuid_column") or "").strip()
        filename = str(raw_spec.get("filename") or "").strip()
        if not source_column or source_column not in available_columns:
            raise ValueError(f"{name}: source column {source_column!r} was not produced.")
        if not output_field:
            raise ValueError(f"{name}: output field is required.")
        if not filename.lower().endswith(".jsonl") or Path(filename).name != filename:
            raise ValueError(f"{name}: filename must be a plain .jsonl filename.")
        normalized_filename = filename.casefold()
        if normalized_filename in seen_filenames:
            raise ValueError(f"{name}: JSONL filename {filename!r} is already in use.")
        seen_filenames.add(normalized_filename)
        if uuid_column and uuid_column not in available_columns:
            raise ValueError(f"{name}: UUID column {uuid_column!r} was not produced.")

        target = export_dir / filename
        with target.open("w", encoding = "utf-8", newline = "\n") as handle:
            for record in dataframe.to_dict(orient = "records"):
                output = {
                    output_field: _decoded_json_value(
                        make_jsonable(record.get(source_column))
                    )
                }
                if uuid_column:
                    output[uuid_column] = make_jsonable(record.get(uuid_column))
                handle.write(json.dumps(output, ensure_ascii = False) + "\n")
        created.append(
            {
                "name": name,
                "filename": filename,
                "rows": int(len(dataframe)),
            }
        )
    return created
