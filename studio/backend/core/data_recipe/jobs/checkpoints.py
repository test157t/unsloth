# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

"""Validate recipe recovery state before admitting a restart, as training does."""

from pathlib import Path
import json
import re
import hashlib
import glob


def seed_fingerprints(recipe: dict) -> dict[str, str]:
    """Pin local source contents so a restart cannot silently use edited input."""
    seed = recipe.get("seed_config") or {}
    source = seed.get("source") or {}
    if source.get("seed_type") != "local":
        return {}
    paths = seed.get("resolved_paths") or [source.get("path")]
    result = {}
    for pattern in paths:
        if not isinstance(pattern, str) or not pattern:
            continue
        for filename in sorted(glob.glob(pattern, recursive=True)):
            path = Path(filename).resolve()
            if path.is_file():
                digest = hashlib.sha256()
                with path.open("rb") as handle:
                    for block in iter(lambda: handle.read(1024 * 1024), b""):
                        digest.update(block)
                result[str(path)] = digest.hexdigest()
    return result


def validate_checkpoint(artifact: str, run: dict, recipe: dict | None = None) -> int:
    import pyarrow.parquet as pq
    from utils.paths import recipe_datasets_root

    base = Path(artifact).resolve()
    if base.parent != recipe_datasets_root().resolve() or not base.is_dir():
        raise ValueError("The saved recipe artifact is missing or outside the dataset directory.")
    rows = int(run.get("rows") or 1000)
    size = int((run.get("run_config") or {}).get("buffer_size") or 1000)
    metadata_path = base / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
    if recipe is not None and run.get("_seed_fingerprints") is not None:
        if seed_fingerprints(recipe) != run["_seed_fingerprints"]:
            raise ValueError("The seed dataset changed since this run started. Restore its original contents before resuming.")
    if metadata.get("buffer_size"):
        if (run.get("run_config") or {}).get("buffer_size") and size != metadata["buffer_size"]:
            raise ValueError("Saved batch size differs from the run configuration.")
        size = int(metadata["buffer_size"])
    paths = sorted((base / "parquet-files").glob("batch_*.parquet"))
    staged = base / ".merge-in-progress.parquet"
    if staged.is_file():
        try:
            merged = pq.read_table(staged)
            if merged.num_rows == metadata.get("actual_num_records"):
                return merged.num_rows
        except Exception:
            pass
    if not paths:
        raise ValueError("No completed recipe batches are available to resume.")
    total = 0
    allows_resize = bool(recipe and (
        recipe.get("processors") or any(c.get("allow_resize") for c in recipe.get("columns", []))
    ))
    for path in paths:
        match = re.fullmatch(r"batch_(\d+)\.parquet", path.name)
        if not match or int(match[1]) * size >= rows:
            raise ValueError(f"Invalid saved batch: {path.name}")
        # Read pages, not just the footer: a truncated data page is not a checkpoint.
        table = pq.read_table(path)
        if not table.column_names:
            raise ValueError(f"Saved batch has no columns: {path.name}")
        if metadata.get("schema") and set(table.column_names) != set(metadata["schema"]):
            raise ValueError(f"Saved batch is missing completed output columns: {path.name}")
        if not allows_resize and not metadata.get("studio_merged_complete"):
            expected = min(size, rows - int(match[1]) * size)
            if table.num_rows != expected:
                raise ValueError(f"Saved batch {path.name} has {table.num_rows} of {expected} rows; preserve it separately and replay this batch.")
        total += table.num_rows
    if metadata.get("studio_merged_complete") and total != metadata.get("actual_num_records"):
        raise ValueError("The merged recipe output does not match its saved row count.")
    return total
