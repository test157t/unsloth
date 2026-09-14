# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

"""Remove recipe history and optionally its owned artifact, using a staged rename."""
import json
import shutil
import uuid
from pathlib import Path

from utils.paths import recipe_datasets_root
from core.training.account_jobs import job_control
from .manager import _resume_state_path


def _artifact_path(value: str) -> Path:
    path = Path(value)
    root = recipe_datasets_root().resolve()
    resolved = path.resolve()
    if resolved.parent != root or path.is_symlink():
        raise ValueError("Recipe artifacts must be a direct dataset directory inside the recipe output folder.")
    # A junction is an alias too, even when it points inside the output root.
    if path.exists() and getattr(path.lstat(), "st_file_attributes", 0) & 0x400:
        raise ValueError("Cannot delete a linked recipe artifact directory.")
    if resolved.exists() and not resolved.is_dir():
        raise ValueError("Recipe artifact path is not a directory.")
    return resolved


@job_control
def delete_saved_job(manager, job_id: str, *, delete_artifacts: bool = False,
                     artifact_path: str | None = None) -> dict:
    staged = None
    with manager._lock:
        current = manager._job
        is_current = current is not None and current.job_id == job_id
        worker_alive = manager._proc is not None and manager._proc.is_alive()
        pump_alive = manager._pump_thread is not None and manager._pump_thread.is_alive()
        if is_current and (worker_alive or pump_alive or current.status in {"pending", "active", "pausing", "cancelling"}):
            raise ValueError("Stop the recipe run and wait for its worker to exit before deleting it.")
        saved = manager._saved_run(job_id)
        owned_path = current.artifact_path if is_current else (saved or {}).get("job", {}).get("artifact_path")
        if owned_path and artifact_path and Path(owned_path).resolve() != Path(artifact_path).resolve():
            raise ValueError("The artifact path does not belong to this recipe run.")
        target = _artifact_path(owned_path or artifact_path) if (owned_path or artifact_path) else None
        if target and current and current.artifact_path and not is_current:
            if target == Path(current.artifact_path).resolve():
                raise ValueError("Another recipe run owns this artifact directory.")
        if target and target.exists() and not owned_path:
            # Old browser-only history predates recovery manifests. Accept only
            # an explicitly selected, recognizable recipe output in the same root.
            try:
                metadata = json.loads((target / "metadata.json").read_text(encoding="utf-8"))
                if metadata.get("dataset_name") != target.name:
                    raise ValueError("Artifact metadata does not match the selected directory.")
                recovery = target / "recipe-recovery.json"
                if recovery.exists() and json.loads(recovery.read_text(encoding="utf-8"))["job"]["job_id"] != job_id:
                    raise ValueError("Another recipe run owns this artifact directory.")
            except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
                raise ValueError("Cannot verify the selected recipe artifact.") from exc
        if target and delete_artifacts and current and worker_alive:
            # A different active recipe may be reading this output as seed data.
            seed = (manager._resume_recipe or {}).get("seed_config") or {}
            sources = seed.get("resolved_paths") or [(seed.get("source") or {}).get("path")]
            if any(isinstance(p, str) and Path(p).resolve().is_relative_to(target) for p in sources if p):
                raise ValueError("The active recipe is using these artifacts as seed data.")

        files = []
        pointer = _resume_state_path()
        for candidate in (pointer, pointer.with_suffix(".tmp")):
            if candidate.is_file():
                payload = json.loads(candidate.read_text(encoding="utf-8"))
                if payload.get("job", {}).get("job_id") == job_id:
                    files.append(candidate)
        if target and not delete_artifacts:
            files.extend(p for p in (target / "recipe-recovery.json", target / "recipe-recovery.tmp") if p.is_file())
        originals = {p: p.read_bytes() for p in files}
        try:
            if target and target.exists() and delete_artifacts:
                staged = target.with_name(f".{target.name}.deleting-{uuid.uuid4().hex}")
                target.rename(staged)
            for path in files:
                path.unlink()
        except OSError:
            for path, content in originals.items():
                path.write_bytes(content)
            if staged is not None and staged.exists():
                staged.rename(target)
            raise
        if is_current:
            manager._retire_workflow_key(current)
            manager._job = None
            manager._resume_recipe = None
            manager._resume_run = None
            manager._restart_resume_error = None
            manager._events.clear()
    cleanup_pending = False
    if staged is not None:
        try:
            # The exact direct-child path was validated and renamed under the lock.
            shutil.rmtree(staged)
        except OSError:
            cleanup_pending = True
    return {"deleted": True, "artifacts_deleted": bool(delete_artifacts and target and not cleanup_pending),
            "cleanup_pending": cleanup_pending}
