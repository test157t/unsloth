# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import hashlib
import queue
import sys
from pathlib import Path

from core.data_recipe.jobs import worker


for _entry in tuple(sys.path):
    _site_packages = Path(_entry)
    _win32 = _site_packages / "win32"
    if (_win32 / "lib" / "pywintypes.py").is_file():
        sys.path.extend([str(_win32), str(_win32 / "lib")])
        break


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _events(event_queue: queue.Queue) -> list[dict]:
    values: list[dict] = []
    while True:
        try:
            values.append(event_queue.get_nowait())
        except queue.Empty:
            return values


def test_worker_reopens_artifact_and_generates_only_missing_batches(monkeypatch, tmp_path):
    monkeypatch.setattr(worker, "_ARTIFACT_ROOT", tmp_path)
    recipe = {
        "model_providers": [],
        "model_configs": [],
        "columns": [
            {
                "column_type": "sampler",
                "name": "row_uuid",
                "drop": False,
                "sampler_type": "uuid",
                "params": {},
            }
        ],
    }
    run = {
        "_job_id": "restartable",
        "execution_type": "full",
        "rows": 5,
        "run_config": {"buffer_size": 2},
    }
    first_queue: queue.Queue = queue.Queue()
    worker.run_job_process(event_queue = first_queue, recipe = recipe, run = run)
    first_events = _events(first_queue)
    first_errors = [event for event in first_events if event.get("type") == "job.error"]
    assert not first_errors, first_errors[0]["stack"]
    completed = next(event for event in first_events if event.get("type") == "job.completed")
    artifact = Path(completed["artifact_path"])
    parquet_dir = artifact / "parquet-files"
    first_batch = parquet_dir / "batch_00000.parquet"
    first_hash = _sha256(first_batch)
    (parquet_dir / "batch_00001.parquet").unlink()
    (parquet_dir / "batch_00002.parquet").unlink()
    dirty_partial = artifact / "tmp-partial-parquet-files"
    dirty_partial.mkdir()
    (dirty_partial / "unfinished.parquet").write_bytes(b"incomplete")

    resumed_queue: queue.Queue = queue.Queue()
    worker.run_job_process(
        event_queue = resumed_queue,
        recipe = recipe,
        run = {**run, "_resume_artifact_path": str(artifact)},
    )
    resumed_events = _events(resumed_queue)
    resumed_errors = [event for event in resumed_events if event.get("type") == "job.error"]
    assert not resumed_errors, resumed_errors[0]["stack"]
    assert any(event.get("type") == "job.completed" for event in resumed_events)
    assert _sha256(first_batch) == first_hash
    assert len(list(parquet_dir.glob("batch_*.parquet"))) == 3
    assert not dirty_partial.exists()
    assert [path for path in tmp_path.iterdir() if path.is_dir()] == [artifact]

    import pandas as pd

    dataset = pd.concat(
        [pd.read_parquet(path) for path in sorted(parquet_dir.glob("batch_*.parquet"))],
        ignore_index = True,
    )
    assert len(dataset) == 5


def test_restart_resume_recognizes_already_merged_complete_dataset(monkeypatch, tmp_path):
    monkeypatch.setattr(worker, "_ARTIFACT_ROOT", tmp_path)
    recipe = {
        "model_providers": [],
        "model_configs": [],
        "columns": [
            {
                "column_type": "sampler",
                "name": "row_uuid",
                "drop": False,
                "sampler_type": "uuid",
                "params": {},
            }
        ],
    }
    run = {
        "_job_id": "merged-restartable",
        "execution_type": "full",
        "rows": 5,
        "merge_batches": True,
        "run_config": {"buffer_size": 2},
    }
    first_queue: queue.Queue = queue.Queue()
    worker.run_job_process(event_queue = first_queue, recipe = recipe, run = run)
    first_events = _events(first_queue)
    first_errors = [event for event in first_events if event.get("type") == "job.error"]
    assert not first_errors, first_errors[0]["stack"]
    completed = next(event for event in first_events if event.get("type") == "job.completed")
    artifact = Path(completed["artifact_path"])
    merged_file = artifact / "parquet-files" / "batch_00000.parquet"
    merged_hash = _sha256(merged_file)
    staged_merge = artifact / ".merge-in-progress.parquet"
    merged_file.replace(staged_merge)

    resumed_queue: queue.Queue = queue.Queue()
    worker.run_job_process(
        event_queue = resumed_queue,
        recipe = recipe,
        run = {**run, "_resume_artifact_path": str(artifact)},
    )
    resumed_events = _events(resumed_queue)
    resumed_errors = [event for event in resumed_events if event.get("type") == "job.error"]
    assert not resumed_errors, resumed_errors[0]["stack"]
    assert _sha256(merged_file) == merged_hash
    assert not staged_merge.exists()

    import pandas as pd

    assert len(pd.read_parquet(merged_file)) == 5


def test_stop_then_restart_preserves_ordered_seed_and_replays_partial(monkeypatch, tmp_path):
    import threading
    import pandas as pd

    root = tmp_path / "artifacts"
    root.mkdir()
    monkeypatch.setattr(worker, "_ARTIFACT_ROOT", root)
    seed = tmp_path / "seed.parquet"
    pd.DataFrame({"source_id": list(range(5))}).to_parquet(seed, index=False)
    recipe = {
        "model_providers": [], "model_configs": [],
        "seed_config": {"source": {"seed_type": "local", "path": str(seed)}, "sampling_strategy": "ordered"},
        "columns": [{"column_type": "expression", "name": "answer", "expr": "{{ source_id }}"}],
    }
    run = {"_job_id": "ordered", "execution_type": "full", "rows": 5, "run_config": {"buffer_size": 2}}
    stop = threading.Event()
    stop.set()
    events = queue.Queue()
    worker.run_job_process(event_queue=events, recipe=recipe, run=run, pause_event=stop)
    first = _events(events)
    assert not [e for e in first if e["type"] == "job.error"], first
    assert any(e["type"] == "job.paused" for e in first)
    artifact = Path(next(e["artifact_path"] for e in first if e["type"] == "job.checkpoint"))
    saved = artifact / "parquet-files" / "batch_00000.parquet"
    digest = _sha256(saved)
    partial = artifact / "tmp-partial-parquet-files"
    partial.mkdir(exist_ok=True)
    # A valid Parquet file after seed generation still has no answer column.
    pd.DataFrame({"source_id": [2, 3]}).to_parquet(partial / "batch_00001.parquet", index=False)
    events = queue.Queue()
    worker.run_job_process(event_queue=events, recipe=recipe, run={**run, "_resume_artifact_path": str(artifact)})
    final = _events(events)
    assert not [e for e in final if e["type"] == "job.error"], final
    assert any(e["type"] == "job.completed" for e in final)
    assert _sha256(saved) == digest
    data = pd.concat([pd.read_parquet(p) for p in sorted((artifact / "parquet-files").glob("*.parquet"))])
    assert data.source_id.tolist() == list(range(5))
    assert data.answer.astype(str).tolist() == [str(i) for i in range(5)]
    assert list((artifact / "interrupted-batches").glob("*/batch_00001.parquet"))


def test_inference_worker_failure_never_commits_a_short_batch(monkeypatch, tmp_path):
    import pandas as pd
    from data_designer.config.column_configs import CustomColumnConfig
    from data_designer.config.custom_column import custom_column_generator

    root = tmp_path / "artifacts"
    root.mkdir()
    monkeypatch.setattr(worker, "_ARTIFACT_ROOT", root)
    seed = tmp_path / "seed.parquet"
    pd.DataFrame({"source_id": list(range(5))}).to_parquet(seed, index=False)
    recipe = {
        "model_providers": [], "model_configs": [],
        "seed_config": {"source": {"seed_type": "local", "path": str(seed)}, "sampling_strategy": "ordered"},
        "columns": [{"column_type": "expression", "name": "input", "expr": "{{ source_id }}"}],
    }
    fail = True

    @custom_column_generator(required_columns=["input"])
    def generate(row):
        if fail and row["source_id"] == 2:
            raise RuntimeError("authentication expired")
        return {**row, "answer": str(row["source_id"])}

    original_builder = worker.build_config_builder
    def build(config):
        builder = original_builder(config)
        builder.add_column(CustomColumnConfig(name="answer", generator_function=generate))
        return builder
    monkeypatch.setattr(worker, "build_config_builder", build)
    run = {"_job_id":"failure", "execution_type":"full", "rows":5, "run_config":{"buffer_size":2}}
    events = queue.Queue()
    worker.run_job_process(event_queue=events, recipe=recipe, run=run)
    first = _events(events)
    assert any(e["type"] == "job.error" for e in first)
    assert not any(e["type"] == "job.completed" for e in first)
    artifact = Path(next(e["artifact_path"] for e in first if e["type"] == "job.checkpoint"))
    assert [p.name for p in (artifact / "parquet-files").glob("*.parquet")] == ["batch_00000.parquet"]
    saved = artifact / "parquet-files" / "batch_00000.parquet"
    digest = _sha256(saved)
    fail = False
    events = queue.Queue()
    worker.run_job_process(event_queue=events, recipe=recipe, run={**run, "_resume_artifact_path":str(artifact)})
    resumed = _events(events)
    assert not [e for e in resumed if e["type"] == "job.error"], resumed
    assert any(e["type"] == "job.completed" for e in resumed)
    assert _sha256(saved) == digest
    data = pd.concat([pd.read_parquet(p) for p in sorted((artifact / "parquet-files").glob("*.parquet"))])
    assert data.source_id.tolist() == list(range(5))
    assert data.answer.tolist() == [str(i) for i in range(5)]
