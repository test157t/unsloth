# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import json
import structlog
import loggers
import logging
import re
import shutil
import time
import traceback
import unicodedata
from pathlib import Path
from typing import Any

from ..jsonable import to_jsonable, to_preview_jsonable
from ..jsonl_export import write_jsonl_exports
from .constants import (
    EVENT_JOB_CHECKPOINT,
    EVENT_JOB_COMPLETED,
    EVENT_JOB_ERROR,
    EVENT_JOB_PAUSED,
    EVENT_JOB_STARTED,
)
from ..service import build_config_builder, create_data_designer
from utils.paths import ensure_dir, recipe_datasets_root

# Fresh spawned interpreter: re-apply main.py's OS-trust-store injection.
from utils.native_tls import activate_native_tls
from utils.paths.path_utils import drop_appledouble_metadata

activate_native_tls()

_ARTIFACT_ROOT = recipe_datasets_root()
_RE_GITHUB_CURSOR = re.compile(r"\bcursor=[^\s,]+")
_RE_SECRET_TOKEN = re.compile(
    r"\b(?:(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]+|sk-unsloth-[A-Za-z0-9]+)"
)


def _sanitize_log_message(message: str) -> str:
    message = _RE_GITHUB_CURSOR.sub("cursor=<redacted>", message)
    return _RE_SECRET_TOKEN.sub("<redacted-token>", message)


class _QueueLogHandler(logging.Handler):
    def __init__(self, event_queue):
        super().__init__()
        self._q = event_queue

    def emit(self, record: logging.LogRecord) -> None:
        try:
            event = {
                "type": "log",
                "ts": record.created,
                "level": record.levelname,
                "logger": record.name,
                "message": _sanitize_log_message(record.getMessage()),
            }
            self._q.put(event)
        except (OSError, RuntimeError, ValueError):
            pass


def _slugify_run_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    if not slug:
        return ""
    return slug[:80].strip("-")


def _build_dataset_name(*, run_name: str | None, job_id: str, artifact_root: Path) -> str:
    fallback = f"recipe_{job_id}"
    slug = _slugify_run_name(run_name or "")
    base_name = f"recipe_{slug}" if slug else fallback
    candidate = base_name
    suffix = 2
    while (artifact_root / candidate).exists():
        candidate = f"{base_name}_{suffix}"
        suffix += 1
    return candidate


def _validated_resume_artifact(value: object) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        return None
    artifact = Path(value).resolve()
    root = _ARTIFACT_ROOT.resolve()
    if not artifact.is_relative_to(root) or artifact.parent != root or not artifact.is_dir():
        raise ValueError("The saved recipe checkpoint path is invalid or missing.")
    return artifact


def _batch_number(path: Path) -> int | None:
    match = re.fullmatch(r"batch_(\d+)\.parquet", path.name)
    return None if match is None else int(match.group(1))


def _parquet_row_count(paths: list[Path]) -> int:
    import pyarrow.parquet as pq

    return sum(int(pq.ParquetFile(path).metadata.num_rows) for path in paths)


def _recover_interrupted_merge(base_dataset_path: Path) -> None:
    staged_merge = base_dataset_path / ".merge-in-progress.parquet"
    if not staged_merge.is_file():
        return
    parquet_dir = base_dataset_path / "parquet-files"
    existing = list(parquet_dir.glob("*.parquet")) if parquet_dir.is_dir() else []
    if existing:
        staged_merge.unlink()
        return
    parquet_dir.mkdir(parents = True, exist_ok = True)
    merged_file = parquet_dir / "batch_00000.parquet"
    staged_merge.replace(merged_file)
    _rewrite_merged_metadata(
        base_dataset_path = base_dataset_path,
        parquet_file = merged_file,
    )


def _build_resumed_dataset(
    dataset_builder,
    *,
    num_records: int,
    on_batch_complete,
    save_multimedia_to_disk: bool = True,
) -> Path:
    """Continue missing durable batches in an existing Data Designer artifact."""
    import uuid

    from data_designer.engine.storage.media_storage import StorageMode

    dataset_builder._run_model_health_check_if_needed()
    dataset_builder._run_mcp_tool_check_if_needed()
    dataset_builder._write_builder_config()
    if dataset_builder._has_image_columns():
        mode = StorageMode.DISK if save_multimedia_to_disk else StorageMode.DATAFRAME
        dataset_builder.artifact_storage.set_media_storage_mode(mode)

    generators = dataset_builder._initialize_generators()
    start_time = time.perf_counter()
    buffer_size = dataset_builder._resource_provider.run_config.buffer_size
    batch_manager = dataset_builder.batch_manager
    batch_manager.start(num_records = num_records, buffer_size = buffer_size)

    parquet_dir = dataset_builder.artifact_storage.final_dataset_path
    existing_paths = sorted(parquet_dir.glob("batch_*.parquet")) if parquet_dir.is_dir() else []
    metadata_path = dataset_builder.artifact_storage.base_dataset_path / "metadata.json"
    merged_complete = False
    if metadata_path.is_file():
        try:
            metadata = json.loads(metadata_path.read_text(encoding = "utf-8"))
            merged_complete = bool(
                isinstance(metadata, dict) and metadata.get("studio_merged_complete")
            )
        except (OSError, TypeError, ValueError):
            pass
    existing_batches = {
        batch_number
        for path in existing_paths
        if (batch_number := _batch_number(path)) is not None
    }
    batch_manager._actual_num_records = _parquet_row_count(existing_paths)
    group_id = uuid.uuid4().hex

    scratch_generator = next(
        (generator for generator in generators if generator.can_generate_from_scratch),
        None,
    )
    for batch_idx in range(batch_manager.num_batches):
        batch_manager._current_batch_number = batch_idx
        if merged_complete or batch_idx in existing_batches:
            if scratch_generator is not None:
                scratch_generator.generate_from_scratch(batch_manager.num_records_batch)
            continue
        loggers.get_logger(__name__).info(
            "⏳ Resuming batch %s of %s",
            batch_idx + 1,
            batch_manager.num_batches,
        )
        dataset_builder._run_batch(
            generators,
            batch_mode = "batch",
            group_id = group_id,
            current_batch_number = batch_idx,
            on_batch_complete = on_batch_complete,
        )

    partial_path = dataset_builder.artifact_storage.partial_results_path
    if partial_path.is_dir():
        batch_manager.finish()
    else:
        batch_manager.reset()

    final_paths = sorted(parquet_dir.glob("batch_*.parquet"))
    if final_paths:
        import pyarrow.parquet as pq

        dataset_builder.artifact_storage.write_metadata(
            {
                "target_num_records": num_records,
                "actual_num_records": _parquet_row_count(final_paths),
                "total_num_batches": len(final_paths),
                "buffer_size": buffer_size,
                "schema": {
                    field.name: str(field.type)
                    for field in pq.read_schema(final_paths[0])
                },
                "file_paths": dataset_builder.artifact_storage.get_file_paths(),
                "num_completed_batches": len(final_paths),
                "dataset_name": dataset_builder.artifact_storage.dataset_name,
                "studio_merged_complete": merged_complete,
            }
        )

    dataset_builder._processor_runner.run_after_generation(buffer_size)
    dataset_builder._resource_provider.model_registry.log_model_usage(
        time.perf_counter() - start_time
    )
    return dataset_builder.artifact_storage.final_dataset_path


def run_job_process(
    *,
    event_queue,
    recipe: dict[str, Any],
    run: dict[str, Any],
    pause_event = None,
) -> None:
    """Subprocess entrypoint. Sends events to `event_queue`."""
    import os

    os.environ["PYTHONWARNINGS"] = "ignore"  # suppress C-level warnings before imports

    import warnings
    from loggers.config import LogConfig

    if os.getenv("ENVIRONMENT_TYPE", "production") == "production":
        warnings.filterwarnings("ignore")

    LogConfig.setup_logging(
        service_name = "unsloth-studio-data-worker",
        env = os.getenv("ENVIRONMENT_TYPE", "production"),
    )

    event_queue.put({"type": EVENT_JOB_STARTED, "ts": time.time()})

    try:
        from data_designer.config.run_config import RunConfig

        rows = int(run.get("rows") or 1000)
        job_id = str(run.get("_job_id") or "").strip()
        if not job_id:
            job_id = f"{int(time.time())}"
        run_name_raw = run.get("run_name")
        run_name = run_name_raw if isinstance(run_name_raw, str) else None
        resume_artifact = _validated_resume_artifact(run.get("_resume_artifact_path"))
        dataset_name = (
            resume_artifact.name
            if resume_artifact is not None
            else _build_dataset_name(
                run_name = run_name,
                job_id = job_id,
                artifact_root = _ARTIFACT_ROOT,
            )
        )
        merge_batches = bool(run.get("merge_batches"))
        ensure_dir(_ARTIFACT_ROOT)
        if resume_artifact is not None:
            _recover_interrupted_merge(resume_artifact)
            partial_path = resume_artifact / "tmp-partial-parquet-files"
            if partial_path.is_dir():
                shutil.rmtree(partial_path)
        run_config_raw = run.get("run_config") or {}

        builder = build_config_builder(recipe)
        designer = create_data_designer(recipe, artifact_path = str(_ARTIFACT_ROOT))

        # DataDesigner resets root logging in __init__; attach the queue handler
        # to the named loggers directly so parser events survive.
        handler = _QueueLogHandler(event_queue)
        handler.setLevel(logging.INFO)
        for logger_name in (
            "data_designer",
            "scraper",
            "gh_client",
            "data_designer_github_repo_seed",
        ):
            logger = logging.getLogger(logger_name)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
            logger.propagate = True

        if run_config_raw:
            designer.set_run_config(RunConfig.model_validate(run_config_raw))

        execution_type = str(run.get("execution_type") or "full").strip().lower()
        if execution_type == "preview":
            results = designer.preview(builder, num_records = rows)
            analysis = (
                None
                if results.analysis is None
                else to_jsonable(results.analysis.model_dump(mode = "json"))
            )
            dataset = (
                []
                if results.dataset is None
                else to_preview_jsonable(results.dataset.to_dict(orient = "records"))
            )
            processor_artifacts = (
                None
                if results.processor_artifacts is None
                else to_jsonable(results.processor_artifacts)
            )
            event_queue.put(
                {
                    "type": EVENT_JOB_COMPLETED,
                    "ts": time.time(),
                    "analysis": analysis,
                    "dataset": dataset,
                    "processor_artifacts": processor_artifacts,
                    "artifact_path": None,
                    "execution_type": execution_type,
                }
            )
        else:
            # Data Designer already commits every finished batch to Parquet. Its
            # public create() wrapper does not expose the builder callback, so
            # narrow-patch the builder inside this dedicated worker process and
            # wait only after a durable batch checkpoint has landed.
            from data_designer.engine.dataset_builders.column_wise_builder import (
                ColumnWiseDatasetBuilder,
            )
            from data_designer.engine.storage.artifact_storage import ArtifactStorage

            original_build = ColumnWiseDatasetBuilder.build
            original_resolved_dataset_name = ArtifactStorage.resolved_dataset_name

            def build_with_pause_checkpoint(dataset_builder, *args, **kwargs):
                caller_callback = kwargs.get("on_batch_complete")

                def on_batch_complete(path: Path) -> None:
                    if caller_callback is not None:
                        caller_callback(path)
                    checkpoint_path = Path(path)
                    event_queue.put(
                        {
                            "type": EVENT_JOB_CHECKPOINT,
                            "ts": time.time(),
                            "artifact_path": str(checkpoint_path.parent.parent),
                        }
                    )
                    if pause_event is None or not pause_event.is_set():
                        return
                    event_queue.put({"type": EVENT_JOB_PAUSED, "ts": time.time()})
                    while pause_event.is_set():
                        time.sleep(0.1)

                kwargs["on_batch_complete"] = on_batch_complete
                if resume_artifact is not None:
                    return _build_resumed_dataset(dataset_builder, *args, **kwargs)
                return original_build(dataset_builder, *args, **kwargs)

            ColumnWiseDatasetBuilder.build = build_with_pause_checkpoint
            if resume_artifact is not None:
                ArtifactStorage.resolved_dataset_name = property(
                    lambda artifact_storage: artifact_storage.dataset_name
                )
            try:
                results = designer.create(builder, num_records = rows, dataset_name = dataset_name)
                if resume_artifact is not None:
                    results.artifact_storage.__dict__["resolved_dataset_name"] = dataset_name
            finally:
                ColumnWiseDatasetBuilder.build = original_build
                ArtifactStorage.resolved_dataset_name = original_resolved_dataset_name
            analysis = to_jsonable(results.load_analysis().model_dump(mode = "json"))
            if merge_batches:
                _merge_batches_to_single_parquet(results.artifact_storage.base_dataset_path)
            artifact_path = str(results.artifact_storage.base_dataset_path)
            export_files = write_jsonl_exports(
                base_dataset_path = results.artifact_storage.base_dataset_path,
                specs = recipe.get("exports"),
            )
            event_queue.put(
                {
                    "type": EVENT_JOB_COMPLETED,
                    "ts": time.time(),
                    "analysis": analysis,
                    "artifact_path": artifact_path,
                    "export_files": export_files,
                    "execution_type": execution_type,
                }
            )
    except Exception as exc:
        event_queue.put(
            {
                "type": EVENT_JOB_ERROR,
                "ts": time.time(),
                "error": _sanitize_log_message(str(exc)),
                "stack": _sanitize_log_message(traceback.format_exc(limit = 20)),
            }
        )


def _merge_batches_to_single_parquet(base_dataset_path: Path) -> None:
    parquet_dir = base_dataset_path / "parquet-files"
    # Counted, so a companion makes a single-batch job take the merge path and rewrite a
    # dataset that needed none.
    parquet_files = drop_appledouble_metadata(sorted(parquet_dir.glob("*.parquet")))
    if len(parquet_files) <= 1:
        return

    try:
        from data_designer.config.utils.io_helpers import read_parquet_dataset
    except ImportError:
        return

    dataframe = read_parquet_dataset(parquet_dir)
    staged_merge = base_dataset_path / ".merge-in-progress.parquet"
    dataframe.to_parquet(staged_merge, index = False)
    shutil.rmtree(parquet_dir)
    parquet_dir.mkdir(parents = True, exist_ok = True)
    merged_file = parquet_dir / "batch_00000.parquet"
    staged_merge.replace(merged_file)
    _rewrite_merged_metadata(
        base_dataset_path = base_dataset_path,
        parquet_file = merged_file,
    )


def _rewrite_merged_metadata(*, base_dataset_path: Path, parquet_file: Path) -> None:
    metadata_path = base_dataset_path / "metadata.json"
    if not metadata_path.exists():
        return

    try:
        metadata = json.loads(metadata_path.read_text(encoding = "utf-8"))
    except (OSError, TypeError, ValueError):
        return

    if not isinstance(metadata, dict):
        return

    relative_parquet_path = str(parquet_file.relative_to(base_dataset_path))
    file_paths = metadata.get("file_paths")
    if not isinstance(file_paths, dict):
        file_paths = {}
    file_paths["parquet-files"] = [relative_parquet_path]
    metadata["file_paths"] = file_paths
    metadata["total_num_batches"] = 1
    metadata["num_completed_batches"] = 1
    metadata["studio_merged_complete"] = True

    try:
        metadata_path.write_text(
            json.dumps(metadata, indent = 2, sort_keys = True),
            encoding = "utf-8",
        )
    except OSError:
        return
