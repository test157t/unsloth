# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import asyncio
import dataclasses
import json
import queue
import threading
import time
import uuid
from pathlib import Path
from collections import deque
from dataclasses import dataclass
from typing import Any

import multiprocessing as mp

from ..jsonable import to_preview_jsonable
from .constants import (
    EVENT_JOB_CANCELLING,
    EVENT_JOB_CANCELLED,
    EVENT_JOB_CHECKPOINT,
    EVENT_JOB_COMPLETED,
    EVENT_JOB_ENQUEUED,
    EVENT_JOB_ERROR,
    EVENT_JOB_PAUSED,
    EVENT_JOB_PAUSING,
    EVENT_JOB_RESUMED,
    EVENT_JOB_STARTED,
)
from .parse import apply_update, coerce_event, parse_log_message
from .types import BatchProgress, Job, ModelUsage, Progress, SourceProgress
from loggers import get_logger
from utils.paths import ensure_dir, studio_root

logger = get_logger(__name__)


_CTX = mp.get_context("spawn")


def _resume_state_path() -> Path:
    return studio_root() / "state" / "data-recipe-current.json"


def _strip_persisted_secrets(value: Any) -> Any:
    """Keep replay configuration on disk without copying credentials into it."""
    if isinstance(value, list):
        return [_strip_persisted_secrets(item) for item in value]
    if not isinstance(value, dict):
        return value
    result: dict[str, Any] = {}
    for key, item in value.items():
        if key == "api_key":
            continue
        result[key] = _strip_persisted_secrets(item)
    if result.get("provider_type") == "stdio" and isinstance(result.get("env"), dict):
        result["env"] = {key: "" for key in result["env"]}
    return result


def _restart_resume_error(recipe: dict[str, Any]) -> str | None:
    seed_config = recipe.get("seed_config")
    if isinstance(seed_config, dict) and str(
        seed_config.get("sampling_strategy") or ""
    ).lower() == "shuffle":
        return (
            "Restart resume is unavailable for shuffled seed sampling because "
            "Data Designer cannot restore the reader's shuffle state."
        )
    for provider in recipe.get("model_providers") or []:
        if (
            isinstance(provider, dict)
            and not provider.get("is_local")
            and isinstance(provider.get("api_key"), str)
            and provider["api_key"].strip()
        ):
            return (
                "Restart resume cannot retain a directly entered provider API key. "
                "Use an API-key environment variable before starting the run."
            )
    for provider in recipe.get("mcp_providers") or []:
        if not isinstance(provider, dict) or provider.get("provider_type") != "stdio":
            continue
        environment = provider.get("env")
        if isinstance(environment, dict) and any(str(value) for value in environment.values()):
            return (
                "Restart resume cannot retain inline tool-server environment secrets. "
                "Use inherited environment variables before starting the run."
            )
    return None


def _restore_job(value: dict[str, Any]) -> Job:
    job = Job(job_id = str(value.get("job_id") or ""))
    for field_name in (
        "stage",
        "current_column",
        "rows",
        "cols",
        "error",
        "started_at",
        "finished_at",
        "analysis",
        "artifact_path",
        "execution_type",
        "dataset",
        "processor_artifacts",
        "export_files",
        "progress_columns_total",
        "source_progress_estimated_total",
        "completed_columns",
        "internal_api_key_id",
    ):
        if field_name in value:
            setattr(job, field_name, value[field_name])
    progress = value.get("progress")
    if isinstance(progress, dict):
        job.progress = Progress(**progress)
    column_progress = value.get("column_progress")
    if isinstance(column_progress, dict):
        job.column_progress = Progress(**column_progress)
    batch = value.get("batch")
    if isinstance(batch, dict):
        job.batch = BatchProgress(**batch)
    source_progress = value.get("source_progress")
    if isinstance(source_progress, dict):
        job.source_progress = SourceProgress(**source_progress)
    model_usage = value.get("model_usage")
    if isinstance(model_usage, dict):
        job.model_usage = {
            str(alias): ModelUsage(**usage)
            for alias, usage in model_usage.items()
            if isinstance(usage, dict)
        }
    job.status = "paused"
    job.finished_at = None
    job.error = None
    return job


def _github_source_estimated_total(recipe: dict) -> int | None:
    seed_config = recipe.get("seed_config")
    if not isinstance(seed_config, dict):
        return None
    source = seed_config.get("source")
    if not isinstance(source, dict) or source.get("seed_type") != "github_repo":
        return None

    repos_raw = source.get("repos")
    repos = (
        [repo for repo in repos_raw if isinstance(repo, str) and repo.strip()]
        if isinstance(repos_raw, list)
        else []
    )
    item_types_raw = source.get("item_types")
    item_types = (
        [
            item
            for item in item_types_raw
            if isinstance(item, str) and item in {"issues", "pulls", "commits"}
        ]
        if isinstance(item_types_raw, list)
        else []
    )
    try:
        limit = int(source.get("limit") or 0)
    except (TypeError, ValueError):
        return None
    if not repos or not item_types or limit <= 0:
        return None
    return len(repos) * len(item_types) * limit


def _source_progress_status(job: Job) -> dict[str, Any] | None:
    progress = job.source_progress
    if progress is None:
        return None
    return {
        "source": progress.source,
        "status": progress.status,
        "repo": progress.repo,
        "resource": progress.resource,
        "page": progress.page,
        "page_items": progress.page_items,
        "fetched_items": progress.fetched_items,
        "estimated_total": progress.estimated_total,
        "percent": progress.percent,
        "rate_remaining": progress.rate_remaining,
        "retry_after_sec": progress.retry_after_sec,
        "message": progress.message,
        "updated_at": progress.updated_at,
    }


@dataclass
class Subscription:
    replay: list[dict]
    _q: queue.Queue
    _next_id: int = 0

    async def next_event(self, *, timeout_sec: float) -> dict | None:
        """Wait for next event (SSE), w/ timeout so we can check disconnects."""
        try:
            return await asyncio.to_thread(self._q.get, True, timeout_sec)
        except queue.Empty:
            return None

    def format_sse(self, event: dict) -> bytes:
        """Turn event dict into SSE bytes (id/event/data)."""
        event_id = event.get("seq")
        if event_id is None:
            self._next_id += 1
            event_id = self._next_id
        body = json.dumps(event, separators = (",", ":"), ensure_ascii = False)
        event_type = event.get("type") or "message"
        return (f"id: {event_id}\n" f"event: {event_type}\n" f"data: {body}\n\n").encode("utf-8")


class JobManager:
    def __init__(self) -> None:
        """Single-job runner (in-mem). Simple on purpose, not a whole platform."""
        self._lock = threading.Lock()
        self._job: Job | None = None
        self._proc: mp.Process | None = None
        self._mp_q: Any | None = None
        self._pause_event: Any | None = None
        self._events: deque[dict] = deque(maxlen = 5000)
        self._subs: list[queue.Queue] = []
        self._pump_thread: threading.Thread | None = None
        self._seq: int = 0
        self._resume_recipe: dict[str, Any] | None = None
        self._resume_run: dict[str, Any] | None = None
        self._restart_resume_error: str | None = None
        self._load_resumable_job()

    def start(
        self,
        *,
        recipe: dict,
        run: dict,
        resume_recipe: dict | None = None,
        internal_api_key_id: int | None = None,
    ) -> str:
        """Spawn the job subprocess (one at a time, no cap).

        ``internal_api_key_id`` is a workflow-scoped sk-unsloth-* key row id
        minted by the route layer; revoked on terminal state so the key's
        live window is no longer than the run.
        """
        llm_columns = recipe.get("columns") or []
        llm_column_count = 0
        if isinstance(llm_columns, list):
            for column in llm_columns:
                if not isinstance(column, dict):
                    continue
                column_type = str(column.get("column_type") or "").strip().lower()
                if column_type.startswith("llm") or column_type.startswith(
                    "unsloth-conditional-llm"
                ):
                    llm_column_count += 1
        if llm_column_count <= 0:
            llm_column_count = 1

        with self._lock:
            if self._proc is not None and self._proc.is_alive():
                raise RuntimeError("job already running")
            if self._job is not None and self._job.status == "paused":
                raise RuntimeError("A paused recipe run must be resumed or stopped first.")

            job_id = uuid.uuid4().hex
            self._job = Job(job_id = job_id, status = "pending", started_at = time.time())
            self._job.progress_columns_total = llm_column_count
            self._job.source_progress_estimated_total = _github_source_estimated_total(recipe)
            self._job.internal_api_key_id = internal_api_key_id
            self._job.execution_type = str(run.get("execution_type") or "full")
            self._resume_recipe = _strip_persisted_secrets(resume_recipe or recipe)
            self._resume_run = dict(run)
            self._restart_resume_error = _restart_resume_error(resume_recipe or recipe)
            self._events.clear()
            self._seq = 0
            self._spawn_worker_locked(recipe = recipe, run = run, job_id = job_id)

            self._emit({"type": EVENT_JOB_ENQUEUED, "ts": time.time(), "job_id": job_id})
            return job_id

    def _spawn_worker_locked(
        self,
        *,
        recipe: dict[str, Any],
        run: dict[str, Any],
        job_id: str,
        resume_artifact_path: str | None = None,
    ) -> None:
        run_payload = dict(run)
        run_payload["_job_id"] = job_id
        if resume_artifact_path:
            run_payload["_resume_artifact_path"] = resume_artifact_path

        from utils.native_path_leases import (
            native_path_secret_removed_for_child_start,
            run_without_native_path_secret,
        )
        from utils.hf_cache_settings import child_environment_for_spawn, get_hf_cache_paths

        cache_env = get_hf_cache_paths().child_env({})
        with (
            child_environment_for_spawn(cache_env),
            native_path_secret_removed_for_child_start(),
        ):
            mp_q = _CTX.Queue()
            pause_event = _CTX.Event()
            proc = _CTX.Process(
                target = run_without_native_path_secret,
                args = ("core.data_recipe.jobs.worker", "run_job_process", cache_env),
                kwargs = {
                    "event_queue": mp_q,
                    "recipe": recipe,
                    "run": run_payload,
                    "pause_event": pause_event,
                },
                daemon = True,
            )
            proc.start()
            from utils.process_lifetime import adopt_pid

            adopt_pid(proc.pid)

        self._mp_q = mp_q
        self._pause_event = pause_event
        self._proc = proc
        self._pump_thread = threading.Thread(target = self._pump_loop, daemon = True)
        self._pump_thread.start()

    def _persist_resumable_locked(self) -> None:
        if (
            self._job is None
            or not self._job.artifact_path
            or self._resume_recipe is None
            or self._resume_run is None
            or self._job.execution_type != "full"
        ):
            return
        target = _resume_state_path()
        try:
            ensure_dir(target.parent)
            persisted_recipe = _strip_persisted_secrets(self._resume_recipe)
            self._resume_recipe = persisted_recipe
            payload = {
                "version": 1,
                "job": dataclasses.asdict(self._job),
                "recipe": persisted_recipe,
                "run": self._resume_run,
                "restart_resume_error": self._restart_resume_error,
            }
            temporary = target.with_suffix(".tmp")
            temporary.write_text(
                json.dumps(
                    payload,
                    ensure_ascii = False,
                    default = lambda value: (
                        sorted(value) if isinstance(value, set) else str(value)
                    ),
                ),
                encoding = "utf-8",
            )
            temporary.replace(target)
        except (OSError, TypeError, ValueError):
            logger.warning("Could not persist the recipe checkpoint", exc_info = True)

    def _delete_resume_state_locked(self) -> None:
        target = _resume_state_path()
        for candidate in (target, target.with_suffix(".tmp")):
            try:
                candidate.unlink(missing_ok = True)
            except OSError:
                logger.warning("Could not remove the completed recipe checkpoint", exc_info = True)

    def _load_resumable_job(self) -> None:
        canonical_target = _resume_state_path()
        temporary_target = canonical_target.with_suffix(".tmp")
        target = canonical_target if canonical_target.is_file() else temporary_target
        if not target.is_file():
            return
        try:
            payload = json.loads(target.read_text(encoding = "utf-8"))
            job_raw = payload.get("job")
            recipe = payload.get("recipe")
            run = payload.get("run")
            if not isinstance(job_raw, dict) or not isinstance(recipe, dict) or not isinstance(run, dict):
                raise ValueError("invalid checkpoint payload")
            job = _restore_job(job_raw)
            if not job.job_id or not job.artifact_path or not Path(job.artifact_path).is_dir():
                raise ValueError("checkpoint artifact is missing")
            self._job = job
            self._resume_recipe = recipe
            self._resume_run = run
            resume_error = payload.get("restart_resume_error")
            self._restart_resume_error = resume_error if isinstance(resume_error, str) else None
            self._events.append(
                {
                    "type": EVENT_JOB_PAUSED,
                    "ts": time.time(),
                    "job_id": job.job_id,
                    "recovered": True,
                    "seq": 1,
                }
            )
            self._seq = 1
            if target == temporary_target:
                ensure_dir(canonical_target.parent)
                temporary_target.replace(canonical_target)
            if job.internal_api_key_id is not None:
                self._retire_workflow_key(job)
                self._persist_resumable_locked()
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            logger.warning("Ignoring an invalid recipe checkpoint", exc_info = True)
            self._delete_resume_state_locked()

    def requires_restart_resume(self, job_id: str) -> bool:
        with self._lock:
            return bool(
                self._job is not None
                and self._job.job_id == job_id
                and self._job.status == "paused"
                and (self._proc is None or not self._proc.is_alive())
            )

    def get_resume_recipe(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return None
            return None if self._resume_recipe is None else json.loads(json.dumps(self._resume_recipe))

    def pause(self, job_id: str) -> bool:
        """Request a cooperative pause after the current durable batch."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return False
            if self._job.execution_type != "full":
                raise ValueError("Only full recipe runs can be paused.")
            if self._job.status not in {"pending", "active"}:
                raise ValueError(f"Cannot pause a recipe run that is {self._job.status}.")
            if self._proc is None or not self._proc.is_alive() or self._pause_event is None:
                raise ValueError("The recipe worker is no longer running.")
            self._pause_event.set()
            self._job.status = "pausing"
            self._persist_resumable_locked()
            self._emit({"type": EVENT_JOB_PAUSING, "ts": time.time(), "job_id": job_id})
            return True

    def resume(
        self,
        job_id: str,
        *,
        recipe: dict[str, Any] | None = None,
        internal_api_key_id: int | None = None,
    ) -> bool:
        """Release a worker paused at a completed batch checkpoint."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return False
            if self._job.status not in {"pausing", "paused"}:
                raise ValueError(f"Cannot resume a recipe run that is {self._job.status}.")
            worker_alive = self._proc is not None and self._proc.is_alive()
            if worker_alive:
                if self._pause_event is None:
                    raise ValueError("The recipe pause control is unavailable.")
                self._pause_event.clear()
            else:
                if not self._job.artifact_path:
                    raise ValueError("The durable recipe checkpoint is missing.")
                if self._restart_resume_error:
                    raise ValueError(self._restart_resume_error)
                if recipe is None or self._resume_run is None:
                    raise ValueError("The saved recipe configuration is unavailable.")
                self._job.internal_api_key_id = internal_api_key_id
                try:
                    self._spawn_worker_locked(
                        recipe = recipe,
                        run = self._resume_run,
                        job_id = job_id,
                        resume_artifact_path = self._job.artifact_path,
                    )
                except Exception:
                    self._job.internal_api_key_id = None
                    raise
            self._job.status = "active"
            self._persist_resumable_locked()
            self._emit({"type": EVENT_JOB_RESUMED, "ts": time.time(), "job_id": job_id})
            return True

    def cancel(self, job_id: str) -> bool:
        """Hard stop. We terminate the subprocess. Quick + reliable."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return False
            if self._proc is None or not self._proc.is_alive():
                self._job.status = "cancelled"
                self._job.finished_at = time.time()
                self._delete_resume_state_locked()
                self._emit({"type": EVENT_JOB_CANCELLED, "ts": time.time(), "job_id": job_id})
                return True
            self._job.status = "cancelling"
            self._delete_resume_state_locked()
            self._emit({"type": EVENT_JOB_CANCELLING, "ts": time.time(), "job_id": job_id})
            try:
                self._proc.terminate()
            except (AttributeError, OSError):
                pass
            return True

    def get_status(self, job_id: str) -> dict | None:
        """UI-friendly structured snapshot; an alternative to SSE."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return None
            job = self._job
            return {
                "job_id": job.job_id,
                "status": job.status,
                "stage": job.stage,
                "current_column": job.current_column,
                "completed_columns": list(job.completed_columns),
                "batch": {"idx": job.batch.idx, "total": job.batch.total},
                "progress": {
                    "done": job.progress.done,
                    "total": job.progress.total,
                    "percent": job.progress.percent,
                    "eta_sec": job.progress.eta_sec,
                    "rate": job.progress.rate,
                    "ok": job.progress.ok,
                    "failed": job.progress.failed,
                },
                "column_progress": {
                    "done": job.column_progress.done,
                    "total": job.column_progress.total,
                    "percent": job.column_progress.percent,
                    "eta_sec": job.column_progress.eta_sec,
                    "rate": job.column_progress.rate,
                    "ok": job.column_progress.ok,
                    "failed": job.column_progress.failed,
                },
                "source_progress": _source_progress_status(job),
                "model_usage": {
                    name: {
                        "model": usage.model,
                        "tokens": {
                            "input": usage.input_tokens,
                            "output": usage.output_tokens,
                            "total": usage.total_tokens,
                            "tps": usage.tps,
                        },
                        "requests": {
                            "success": usage.requests_success,
                            "failed": usage.requests_failed,
                            "total": usage.requests_total,
                            "rpm": usage.rpm,
                        },
                    }
                    for name, usage in job.model_usage.items()
                },
                "rows": job.rows,
                "cols": job.cols,
                "error": job.error,
                "has_analysis": job.analysis is not None,
                "dataset_rows": None if job.dataset is None else len(job.dataset),
                "artifact_path": job.artifact_path,
                "export_files": job.export_files,
                "execution_type": job.execution_type,
                "started_at": job.started_at,
                "finished_at": job.finished_at,
            }

    def get_current_status(self) -> dict | None:
        """Single-job convenience (last/current)."""
        job_id = self.get_current_job_id()
        if job_id is None:
            return None
        return self.get_status(job_id)

    def get_current_job_id(self) -> str | None:
        """Return current job_id (or None)."""
        with self._lock:
            return None if self._job is None else self._job.job_id

    def get_analysis(self, job_id: str) -> dict | None:
        """Final profiling output (only after job completes)."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return None
            return self._job.analysis

    def get_dataset(
        self,
        job_id: str,
        *,
        limit: int,
        offset: int = 0,
    ) -> dict[str, Any] | None:
        """Load dataset page (offset + limit) and include total rows."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return None
            in_memory_dataset = self._job.dataset
            artifact_path = self._job.artifact_path
            job_status = self._job.status

        if in_memory_dataset is not None:
            total = len(in_memory_dataset)
            rows = in_memory_dataset[offset : offset + limit]
            return {"dataset": rows, "total": total}
        if not artifact_path:
            if job_status in {"completed", "error", "cancelled"}:
                return {"error": "artifact path missing"}
            return None

        try:
            base_dataset_path = Path(artifact_path)
            parquet_dir = base_dataset_path / "parquet-files"
            if not parquet_dir.exists():
                return {"error": f"dataset path missing: {parquet_dir}"}

            return self._load_dataset_page(parquet_dir = parquet_dir, limit = limit, offset = offset)
        except Exception as exc:
            return {"error": f"dataset load failed: {exc}"}

    @staticmethod
    def _load_dataset_page(*, parquet_dir: Path, limit: int, offset: int) -> dict[str, Any]:
        dataset_page = JobManager._load_dataset_page_with_duckdb(
            parquet_dir = parquet_dir,
            limit = limit,
            offset = offset,
        )
        if dataset_page is not None:
            return dataset_page
        return JobManager._load_dataset_page_with_data_designer(
            parquet_dir = parquet_dir,
            limit = limit,
            offset = offset,
        )

    @staticmethod
    def _load_dataset_page_with_duckdb(
        *, parquet_dir: Path, limit: int, offset: int
    ) -> dict[str, Any] | None:
        parquet_glob = str((parquet_dir / "*.parquet").resolve())
        try:
            import duckdb  # type: ignore
        except Exception:
            return None

        try:
            conn = duckdb.connect(":memory:")
            try:
                total_row = conn.execute(
                    "SELECT COUNT(*) FROM read_parquet(?)",
                    [parquet_glob],
                ).fetchone()
                total = int(total_row[0] if total_row else 0)
                dataframe = conn.execute(
                    (
                        "SELECT *, row_number() OVER (PARTITION BY filename) AS __row_num__ "
                        "FROM read_parquet(?, filename=true) "
                        "ORDER BY filename, __row_num__ "
                        "LIMIT ? OFFSET ?"
                    ),
                    [parquet_glob, int(limit), int(offset)],
                ).fetchdf()
            finally:
                conn.close()
        except (RuntimeError, ValueError, duckdb.Error):
            return None

        for helper_col in ("filename", "__row_num__"):
            if helper_col in dataframe.columns:
                dataframe = dataframe.drop(columns = [helper_col])

        rows = dataframe.to_dict(orient = "records")
        return {"dataset": to_preview_jsonable(rows), "total": total}

    @staticmethod
    def _load_dataset_page_with_data_designer(
        *, parquet_dir: Path, limit: int, offset: int
    ) -> dict[str, Any]:
        from data_designer.config.utils.io_helpers import read_parquet_dataset

        dataframe = read_parquet_dataset(parquet_dir)
        total = int(len(dataframe.index))
        rows = dataframe.iloc[offset : offset + limit].to_dict(orient = "records")
        return {"dataset": to_preview_jsonable(rows), "total": total}

    def subscribe(
        self,
        job_id: str,
        *,
        after_seq: int | None = None,
    ) -> Subscription | None:
        """SSE subscribe: get replay buffer + live events stream."""
        with self._lock:
            if self._job is None or self._job.job_id != job_id:
                return None
            q: queue.Queue = queue.Queue(maxsize = 2000)
            self._subs.append(q)
            if after_seq is None:
                replay = list(self._events)
            else:
                replay = [e for e in self._events if int(e.get("seq") or 0) > after_seq]
            return Subscription(replay = replay, _q = q)

    def unsubscribe(self, sub: Subscription) -> None:
        """Drop SSE subscriber (client disconnected)."""
        with self._lock:
            self._subs = [q for q in self._subs if q is not sub._q]

    def _emit(self, event: dict) -> None:
        """Broadcast event to replay buffer + all subscribers."""
        self._seq += 1
        event["seq"] = self._seq
        self._events.append(event)
        stale: list[queue.Queue] = []
        for q in self._subs:
            try:
                q.put_nowait(event)
            except queue.Full:
                stale.append(q)
        if stale:
            self._subs = [q for q in self._subs if q not in stale]

    def _snapshot(self) -> tuple[Job, mp.Process, Any] | None:
        """Grab pointers for the pump loop (avoid holding lock too long)."""
        with self._lock:
            if self._job is None or self._proc is None or self._mp_q is None:
                return None
            return self._job, self._proc, self._mp_q

    @staticmethod
    def _read_queue_with_timeout(q: Any, *, timeout_sec: float) -> dict | None:
        """Try read 1 event from mp queue. Timeout = pump stays responsive."""
        try:
            return coerce_event(q.get(timeout = timeout_sec))
        except queue.Empty:
            return None
        except (EOFError, OSError, ValueError):
            return None

    @staticmethod
    def _drain_queue(q: Any) -> list[dict]:
        """Drain mp queue fast (used on process exit)."""
        events: list[dict] = []
        while True:
            try:
                events.append(coerce_event(q.get_nowait()))
            except queue.Empty:
                return events
            except Exception:
                # Return what we have so the run still finalizes rather than wedging "active".
                logger.exception(
                    "Data-recipe job pump: queue drain failed; finalizing with drained events"
                )
                return events

    def _safe_handle_event(self, job: Job, event: dict) -> None:
        """Apply one event, swallowing any handler error so the pump can't die."""
        try:
            self._handle_event(job, event)
        except Exception:
            etype = event.get("type") if isinstance(event, dict) else type(event).__name__
            logger.exception("Data-recipe job pump: failed to handle %s event; skipping", etype)

    def _pump_loop(self) -> None:
        """Background thread: consume worker events and update the job snapshot.

        Guarded so no single event can end the loop; it is the sole writer of the
        snapshot the UI polls, so its death would freeze status/SSE.
        """
        while True:
            snap = self._snapshot()
            if snap is None:
                return
            job, proc, mp_q = snap

            try:
                event = self._read_queue_with_timeout(mp_q, timeout_sec = 0.25)
            except Exception:
                # If a read keeps raising after the worker died, finalize instead
                # of spinning forever; only retry while the worker is still alive.
                logger.exception("Data-recipe job pump: queue read failed; continuing")
                if proc.is_alive():
                    time.sleep(0.1)
                    continue
                event = None

            if event is not None:
                self._safe_handle_event(job, event)
                continue

            if proc.is_alive():
                continue

            # Worker exited: drain + finalize, guarded so an error can't strand the run "active".
            try:
                for e in self._drain_queue(mp_q):
                    self._safe_handle_event(job, e)

                retired_job: Job | None = None
                with self._lock:
                    if self._job and self._job.status in {
                        "pending",
                        "active",
                        "pausing",
                        "paused",
                        "cancelling",
                    }:
                        if self._job.status == "cancelling":
                            self._job.status = "cancelled"
                            self._delete_resume_state_locked()
                        elif self._job.artifact_path and self._resume_recipe is not None:
                            self._job.status = "paused"
                            self._job.error = None
                            self._persist_resumable_locked()
                        else:
                            self._job.status = "error"
                            self._job.error = self._job.error or "process exited"
                            self._delete_resume_state_locked()
                        self._job.finished_at = time.time()
                        event_type = (
                            EVENT_JOB_CANCELLED
                            if self._job.status == "cancelled"
                            else EVENT_JOB_PAUSED
                            if self._job.status == "paused"
                            else EVENT_JOB_ERROR
                        )
                        self._emit(
                            {
                                "type": event_type,
                                "ts": time.time(),
                                "job_id": self._job.job_id,
                            }
                        )
                        retired_job = self._job
                if retired_job is not None:
                    self._retire_workflow_key(retired_job)
            except Exception:
                logger.exception("Data-recipe job pump: finalization after worker exit failed")
            return

    def _handle_event(self, job: Job, event: dict) -> None:
        """Apply event -> job state + forward to SSE."""
        et = event.get("type")
        msg = event.get("message") if et == "log" else None

        terminal = False
        with self._lock:
            if self._job is None or self._job.job_id != job.job_id:
                return
            if et == EVENT_JOB_STARTED and self._job.status != "pausing":
                self._job.status = "active"
            if et == EVENT_JOB_PAUSING:
                self._job.status = "pausing"
            if (
                et == EVENT_JOB_PAUSED
                and self._pause_event is not None
                and self._pause_event.is_set()
            ):
                self._job.status = "paused"
                self._persist_resumable_locked()
            if et == EVENT_JOB_RESUMED:
                self._job.status = "active"
                self._persist_resumable_locked()
            if et == EVENT_JOB_CHECKPOINT:
                checkpoint_path = event.get("artifact_path")
                if isinstance(checkpoint_path, str) and checkpoint_path:
                    self._job.artifact_path = checkpoint_path
                    self._persist_resumable_locked()
            if et == EVENT_JOB_COMPLETED:
                self._job.status = "completed"
                self._job.finished_at = time.time()
                self._job.analysis = event.get("analysis")
                self._job.artifact_path = event.get("artifact_path")
                self._job.execution_type = event.get("execution_type")
                self._job.dataset = event.get("dataset")
                self._job.processor_artifacts = event.get("processor_artifacts")
                export_files = event.get("export_files")
                self._job.export_files = export_files if isinstance(export_files, list) else []
                if self._job.progress.total and self._job.progress.total > 0:
                    self._job.progress.done = self._job.progress.total
                    self._job.progress.percent = 100.0
                terminal = True
                self._delete_resume_state_locked()
            if et == EVENT_JOB_ERROR:
                self._job.status = "error"
                self._job.finished_at = time.time()
                self._job.error = event.get("error") or "error"
                terminal = True
                self._delete_resume_state_locked()
            if et == EVENT_JOB_CANCELLED:
                terminal = True
                self._delete_resume_state_locked()

            if msg:
                upd = parse_log_message(msg)
                if upd:
                    apply_update(self._job, upd)

        if terminal:
            self._retire_workflow_key(job)

        self._emit(event)

    def _retire_workflow_key(self, job: Job) -> None:
        """Revoke the workflow-scoped sk-unsloth-* key, if one was minted.

        Best-effort: failures are swallowed. The key expires after 24h, so a
        missed revoke is a latency, not correctness, concern.
        """
        key_id = getattr(job, "internal_api_key_id", None)
        if not key_id:
            return
        try:
            from auth import storage  # deferred: avoid circular import
            storage.revoke_internal_api_key(int(key_id))
        except Exception:
            pass
        job.internal_api_key_id = None


_JOB_MANAGER: JobManager | None = None


def get_job_manager() -> JobManager:
    """Singleton JobManager (we only run 1 job anyway)."""
    global _JOB_MANAGER
    if _JOB_MANAGER is None:
        _JOB_MANAGER = JobManager()
    return _JOB_MANAGER
