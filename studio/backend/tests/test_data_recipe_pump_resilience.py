# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

"""Data-recipe job pump resilience.

The pump is the sole consumer of worker events and sole writer of the job
snapshot the status/SSE endpoints read; a handler error must not kill it, or the
job stays wedged "active" and the workflow key is never retired. Fakes only.
"""

from __future__ import annotations

import queue
import sys
import threading
import time
import json
from pathlib import Path

import pytest

_BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import core.data_recipe.jobs.manager as manager_module  # noqa: E402
from core.data_recipe.jobs.manager import JobManager  # noqa: E402
from core.data_recipe.jobs.types import Job  # noqa: E402


class _FakeProc:
    def __init__(self, alive: bool = True):
        self._alive = alive

    def is_alive(self):
        return self._alive


class _FakePauseEvent:
    def __init__(self):
        self._set = False

    def set(self):
        self._set = True

    def clear(self):
        self._set = False

    def is_set(self):
        return self._set


class _ScriptedQueue:
    def __init__(self, events):
        self._events = list(events)

    def get(self, timeout = None):
        if self._events:
            return self._events.pop(0)
        raise queue.Empty

    def get_nowait(self):
        if self._events:
            return self._events.pop(0)
        raise queue.Empty


def _wait_until(predicate, timeout = 5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return predicate()


def _manager_with_active_job():
    m = JobManager.__new__(JobManager)
    m._lock = threading.Lock()
    job = Job(job_id = "job-test")
    job.status = "active"
    m._job = job
    m._proc = _FakeProc(alive = True)
    m._mp_q = _ScriptedQueue([])
    return m


def test_pump_survives_handler_exception_and_still_finalizes(monkeypatch):
    m = _manager_with_active_job()
    handled: list = []

    def fake_handle(job, event):
        if event.get("type") == "boom":
            raise RuntimeError("malformed log line")
        handled.append(event.get("type"))

    emitted: list = []
    retired: list = []
    monkeypatch.setattr(m, "_handle_event", fake_handle)
    monkeypatch.setattr(m, "_emit", lambda e: emitted.append(e))
    monkeypatch.setattr(m, "_retire_workflow_key", lambda j: retired.append(j))

    m._mp_q = _ScriptedQueue(
        [{"type": "boom"}, {"type": "log"}, {"type": "boom"}, {"type": "progress"}]
    )

    pump = threading.Thread(target = m._pump_loop, daemon = True)
    pump.start()
    try:
        assert _wait_until(
            lambda: handled == ["log", "progress"]
        ), "pump must keep processing events after a handler raises"
        assert pump.is_alive()
    finally:
        m._proc._alive = False  # worker exits -> pump should finalize and stop
        pump.join(timeout = 5)

    assert not pump.is_alive()
    # The exited worker is finalized as error (not left wedged "active") and the
    # workflow key is retired despite the earlier handler exceptions.
    assert m._job.status == "error"
    assert retired and retired[0] is m._job


def test_pump_finalizes_when_drain_raises(monkeypatch):
    m = _manager_with_active_job()
    monkeypatch.setattr(m, "_emit", lambda e: None)
    retired: list = []
    monkeypatch.setattr(m, "_retire_workflow_key", lambda j: retired.append(j))

    class _BadDrainQueue:
        def get(self, timeout = None):
            raise queue.Empty

        def get_nowait(self):
            raise RuntimeError("corrupt drain payload")

    m._proc = _FakeProc(alive = False)
    m._mp_q = _BadDrainQueue()

    m._pump_loop()  # returns once it sees the dead worker

    assert m._job.status == "error"
    assert retired and retired[0] is m._job


def test_pump_finalizes_when_read_keeps_raising_on_dead_worker(monkeypatch):
    # A read that keeps raising after the child died must not spin the pump
    # forever: once the worker is gone it falls through to finalize.
    m = _manager_with_active_job()
    monkeypatch.setattr(m, "_emit", lambda e: None)
    retired: list = []
    monkeypatch.setattr(m, "_retire_workflow_key", lambda j: retired.append(j))

    class _BrokenReadQueue:
        def get(self, timeout = None):
            raise RuntimeError("broken queue pipe")

        def get_nowait(self):
            raise queue.Empty

    m._proc = _FakeProc(alive = False)
    m._mp_q = _BrokenReadQueue()

    pump = threading.Thread(target = m._pump_loop, daemon = True)
    pump.start()
    pump.join(timeout = 5)
    assert not pump.is_alive(), "pump must finalize a dead worker even when reads keep raising"
    assert m._job.status == "error"
    assert retired and retired[0] is m._job


def test_full_run_pause_and_resume_are_cooperative(monkeypatch):
    m = _manager_with_active_job()
    m._job.execution_type = "full"
    m._pause_event = _FakePauseEvent()
    emitted: list[dict] = []
    monkeypatch.setattr(m, "_emit", lambda event: emitted.append(event))

    assert m.pause("job-test") is True
    assert m._pause_event.is_set() is True
    assert m._job.status == "pausing"
    assert emitted[-1]["type"] == "job.pausing"

    assert m.resume("job-test") is True
    assert m._pause_event.is_set() is False
    assert m._job.status == "active"
    assert emitted[-1]["type"] == "job.resumed"


def test_preview_run_cannot_pause(monkeypatch):
    m = _manager_with_active_job()
    m._job.execution_type = "preview"
    m._pause_event = _FakePauseEvent()
    monkeypatch.setattr(m, "_emit", lambda event: None)

    try:
        m.pause("job-test")
    except ValueError as exc:
        assert "Only full recipe runs" in str(exc)
    else:
        raise AssertionError("preview runs do not have durable pause checkpoints")


def test_durable_checkpoint_restores_paused_job_without_credentials(monkeypatch, tmp_path):
    state_path = tmp_path / "checkpoints" / "current.json"
    artifact_path = tmp_path / "recipe-run"
    artifact_path.mkdir()
    monkeypatch.setattr(manager_module, "_resume_state_path", lambda: state_path)

    manager = JobManager()
    manager._job = Job(
        job_id = "durable-job",
        status = "paused",
        artifact_path = str(artifact_path),
        execution_type = "full",
    )
    manager._resume_recipe = {
        "model_providers": [{"name": "local", "api_key": "do-not-persist"}],
        "columns": [{"name": "answer"}],
    }
    manager._resume_run = {"execution_type": "full", "rows": 2000}
    manager._persist_resumable_locked()

    persisted = json.loads(state_path.read_text(encoding = "utf-8"))
    assert "api_key" not in persisted["recipe"]["model_providers"][0]

    interrupted_write = state_path.with_suffix(".tmp")
    state_path.replace(interrupted_write)

    restored = JobManager()
    assert restored._job is not None
    assert restored._job.job_id == "durable-job"
    assert restored._job.status == "paused"
    assert restored.requires_restart_resume("durable-job") is True
    assert state_path.is_file()
    assert not interrupted_write.exists()


def test_restart_resume_spawns_new_worker_against_existing_artifact(monkeypatch, tmp_path):
    state_path = tmp_path / "checkpoints" / "current.json"
    artifact_path = tmp_path / "recipe-run"
    artifact_path.mkdir()
    monkeypatch.setattr(manager_module, "_resume_state_path", lambda: state_path)
    manager = JobManager()
    manager._job = Job(
        job_id = "durable-job",
        status = "paused",
        artifact_path = str(artifact_path),
        execution_type = "full",
    )
    manager._resume_recipe = {"columns": [{"name": "answer"}]}
    manager._resume_run = {"execution_type": "full", "rows": 2000}
    manager._restart_resume_error = None
    spawned: list[dict] = []

    def fake_spawn(**kwargs):
        spawned.append(kwargs)
        manager._proc = _FakeProc(alive = True)
        manager._pause_event = _FakePauseEvent()

    monkeypatch.setattr(manager, "_spawn_worker_locked", fake_spawn)
    monkeypatch.setattr(manager, "_emit", lambda event: None)

    assert manager.resume("durable-job", recipe = manager._resume_recipe) is True
    assert manager._job.status == "active"
    assert spawned[0]["resume_artifact_path"] == str(artifact_path)


def test_restart_resume_refuses_shuffled_seed_reader(monkeypatch, tmp_path):
    state_path = tmp_path / "checkpoints" / "current.json"
    artifact_path = tmp_path / "recipe-run"
    artifact_path.mkdir()
    monkeypatch.setattr(manager_module, "_resume_state_path", lambda: state_path)
    manager = JobManager()
    manager._job = Job(
        job_id = "durable-job",
        status = "paused",
        artifact_path = str(artifact_path),
        execution_type = "full",
    )
    manager._resume_recipe = {"seed_config": {"sampling_strategy": "shuffle"}}
    manager._resume_run = {"execution_type": "full", "rows": 2000}
    manager._restart_resume_error = manager_module._restart_resume_error(
        manager._resume_recipe
    )

    with pytest.raises(ValueError, match = "shuffle state"):
        manager.resume("durable-job", recipe = manager._resume_recipe)
