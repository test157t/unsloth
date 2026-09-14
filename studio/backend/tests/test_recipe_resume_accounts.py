"""Fork recovery paths must retain upstream account isolation."""
import json

import pytest
from fastapi import HTTPException

from auth import policy
from core.data_recipe.jobs import manager as module
from core.data_recipe.jobs.deletion import delete_saved_job
from utils.account_context import AccountContext, OWNER, run_as
from utils.paths import recipe_datasets_root

ALICE = AccountContext("recipe-alice", "alice")
BOB = AccountContext("recipe-bob", "bob")


@pytest.fixture(autouse=True)
def isolated_accounts(monkeypatch, tmp_path):
    monkeypatch.setenv("UNSLOTH_STUDIO_HOME", str(tmp_path))
    monkeypatch.setattr(policy, "installation_has_managed_accounts", lambda: True)
    monkeypatch.setattr(policy, "installation_is_multi_user", lambda: True)


def saved_run(account, job_id):
    artifact = run_as(account, recipe_datasets_root) / job_id
    artifact.mkdir(parents=True)
    payload = {"job": {"job_id": job_id, "artifact_path": str(artifact)},
               "recipe": {"columns": []}, "run": {"execution_type": "full"}}
    (artifact / "recipe-recovery.json").write_text(json.dumps(payload))
    return payload


def test_checkpoint_pointer_and_recovered_owner_are_account_scoped():
    paths = [run_as(account, module._resume_state_path) for account in (OWNER, ALICE, BOB)]
    assert len(set(paths)) == 3
    payload = saved_run(ALICE, "alice-run")
    paths[1].parent.mkdir(parents=True, exist_ok=True)
    paths[1].write_text(json.dumps(payload))
    manager = run_as(ALICE, module.JobManager)
    assert manager._result_account == ALICE
    assert run_as(ALICE, manager.get_resume_recipe, "alice-run") == payload["recipe"]
    assert run_as(BOB, manager.get_resume_recipe, "alice-run") is None
    assert run_as(BOB, module.JobManager)._job is None


def test_foreign_recovery_controls_cannot_touch_current_job():
    manager = module.JobManager()
    manager._result_account = ALICE
    for call in (manager.pause, manager.resume):
        with pytest.raises(HTTPException) as exc:
            run_as(BOB, call, "alice-run")
        assert exc.value.status_code == 404
    with pytest.raises(HTTPException):
        run_as(BOB, delete_saved_job, manager, "alice-run")


def test_own_archive_can_be_recovered_after_another_accounts_completed_job():
    payload = saved_run(ALICE, "alice-run")
    manager = module.JobManager()
    manager._result_account = BOB
    assert run_as(ALICE, manager.get_resume_recipe, "alice-run") == payload["recipe"]
    assert run_as(ALICE, manager.requires_restart_resume, "alice-run")
    assert manager._result_account == ALICE
    assert manager._job.job_id == "alice-run"
