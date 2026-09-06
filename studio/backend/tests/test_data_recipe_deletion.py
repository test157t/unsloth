# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from pathlib import Path
import json
import threading
from types import SimpleNamespace

import pytest

from core.data_recipe.jobs import deletion
from core.data_recipe.jobs.types import Job


@pytest.fixture
def saved_run(tmp_path, monkeypatch):
    root = tmp_path / "recipes"
    root.mkdir()
    artifact = root / "recipe_old"
    artifact.mkdir()
    (artifact / "data.parquet").write_bytes(b"saved output")
    (artifact / "metadata.json").write_text(json.dumps({"dataset_name": artifact.name}))
    job = Job(job_id="old", status="error", artifact_path=str(artifact), execution_type="full")
    payload = {"job": {"job_id":"old", "artifact_path":str(artifact)}}
    (artifact / "recipe-recovery.json").write_text(json.dumps(payload))
    pointer = tmp_path / "current.json"
    pointer.write_text(json.dumps(payload))
    monkeypatch.setattr(deletion, "recipe_datasets_root", lambda: root)
    monkeypatch.setattr(deletion, "_resume_state_path", lambda: pointer)
    manager = SimpleNamespace(
        _lock=threading.Lock(), _job=job, _proc=None, _pump_thread=None,
        _resume_recipe={}, _resume_run={}, _restart_resume_error=None, _events=[],
        _retire_workflow_key=lambda job: None,
        _saved_run=lambda job_id: payload if job_id == "old" and (artifact / "recipe-recovery.json").exists() else None,
    )
    return manager, artifact, pointer


def test_history_deletion_keeps_output_and_removes_resume_registration(saved_run):
    manager, artifact, pointer = saved_run
    result = deletion.delete_saved_job(manager, "old")
    assert result["deleted"] and not result["artifacts_deleted"]
    assert (artifact / "data.parquet").read_bytes() == b"saved output"
    assert not (artifact / "recipe-recovery.json").exists()
    assert not pointer.exists()
    assert manager._job is None


def test_optional_artifact_deletion_removes_only_selected_directory(saved_run):
    manager, artifact, pointer = saved_run
    other = artifact.parent / "recipe_other"
    other.mkdir()
    assert deletion.delete_saved_job(manager, "old", delete_artifacts=True)["artifacts_deleted"]
    assert not artifact.exists() and other.exists() and not pointer.exists()


@pytest.mark.parametrize("status", ["pending", "active", "pausing", "cancelling"])
def test_active_states_cannot_be_deleted(saved_run, status):
    manager, artifact, pointer = saved_run
    manager._job.status = status
    with pytest.raises(ValueError, match="worker to exit"):
        deletion.delete_saved_job(manager, "old", delete_artifacts=True)
    assert artifact.exists() and pointer.exists()


def test_terminal_event_before_worker_exit_is_protected(saved_run):
    manager, artifact, _ = saved_run
    manager._proc = SimpleNamespace(is_alive=lambda: True)
    with pytest.raises(ValueError):
        deletion.delete_saved_job(manager, "old", delete_artifacts=True)
    assert artifact.exists()


def test_forged_job_id_cannot_delete_another_runs_output(saved_run):
    manager, artifact, _ = saved_run
    with pytest.raises(ValueError, match="Another recipe run"):
        deletion.delete_saved_job(manager, "forged", delete_artifacts=True, artifact_path=str(artifact))
    assert artifact.exists()


@pytest.mark.parametrize("path_kind", ["root", "outside"])
def test_deletion_rejects_root_and_outside_paths(saved_run, path_kind):
    manager, artifact, _ = saved_run
    manager._job = None
    path = artifact.parent if path_kind == "root" else artifact.parent.parent
    with pytest.raises(ValueError):
        deletion.delete_saved_job(manager, "missing", delete_artifacts=True, artifact_path=str(path))
    assert artifact.exists()


def test_failed_history_write_restores_staged_artifacts(saved_run, monkeypatch):
    manager, artifact, pointer = saved_run
    original = Path.unlink
    def fail(path, *args, **kwargs):
        if path == pointer:
            raise OSError("locked history")
        return original(path, *args, **kwargs)
    monkeypatch.setattr(Path, "unlink", fail)
    with pytest.raises(OSError):
        deletion.delete_saved_job(manager, "old", delete_artifacts=True)
    assert pointer.exists() and (artifact / "data.parquet").exists()
    assert manager._job is not None


def test_failed_artifact_staging_keeps_history_and_original_error(saved_run, monkeypatch):
    manager, artifact, pointer = saved_run
    original = Path.rename

    def fail(path, *args, **kwargs):
        if path == artifact:
            raise OSError("locked artifact")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "rename", fail)
    with pytest.raises(OSError, match="locked artifact"):
        deletion.delete_saved_job(manager, "old", delete_artifacts=True)
    assert pointer.exists() and (artifact / "data.parquet").exists()
    assert manager._job is not None


def test_legacy_browser_only_run_can_delete_verified_artifact(saved_run):
    manager, artifact, pointer = saved_run
    manager._job = None
    (artifact / "recipe-recovery.json").unlink()
    assert deletion.delete_saved_job(manager, "old", delete_artifacts=True, artifact_path=str(artifact))["artifacts_deleted"]
    assert not artifact.exists() and not pointer.exists()


def test_missing_backend_record_is_idempotent_for_browser_history(saved_run):
    manager, artifact, _ = saved_run
    assert deletion.delete_saved_job(manager, "missing")["deleted"]
    assert artifact.exists()
