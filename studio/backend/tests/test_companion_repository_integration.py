from pathlib import Path
import pytest
from fastapi import HTTPException
from storage import studio_db
from core.inference import tools
from core.code_workspace import git_operation, read_file
from utils.account_context import OWNER, AccountContext, run_as

@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setenv("UNSLOTH_STUDIO_HOME", str(tmp_path / "studio"))
    monkeypatch.setenv("UNSLOTH_STUDIO_PROJECTS_HOME", str(tmp_path / "projects"))
    monkeypatch.setattr(tools,"_workdirs",{})
    repository=tmp_path / "repository"
    repository.mkdir()
    (repository / "keep.txt").write_text("user source",encoding="utf-8")
    record=run_as(OWNER,studio_db.upsert_chat_project,{"id":"editor-test","name":"Editor test","createdAt":1,"updatedAt":1})
    run_as(OWNER,studio_db.update_chat_project,record["id"],{"repositoryPath":str(repository)})
    return record,repository

def test_editor_and_chat_resolve_same_repository(project):
    record,repository=project
    assert run_as(OWNER,tools.resolve_sandbox_workdir,"project-"+record["id"]) == str(repository.resolve())
    saved=run_as(OWNER,studio_db.get_chat_project,record["id"])
    assert saved["repositoryPath"] == str(repository)
    assert Path(saved["sandboxPath"]) != repository

def test_project_deletion_does_not_delete_attached_repository(project):
    record,repository=project
    run_as(OWNER,studio_db.delete_chat_project,record["id"],delete_files=True)
    assert (repository / "keep.txt").read_text() == "user source"

def test_managed_account_does_not_resolve_owner_repository(project,monkeypatch):
    record,repository=project
    assert run_as(AccountContext("member-id","member"),tools._get_project_workdir,"project-"+record["id"]) is None

def test_new_git_controls_review_and_literal_ignore(tmp_path):
    git_operation(tmp_path,"init")
    (tmp_path / "a[1].txt").write_text("file")
    review=git_operation(tmp_path,"review")
    assert review["isRepo"] is True
    assert review["status"][0]["path"] == "a[1].txt"
    git_operation(tmp_path,"ignore","a[1].txt")
    assert read_file(tmp_path,".gitignore")["content"] == "/a\\[1\\].txt\n"
    assert all(item["path"] != "a[1].txt" for item in git_operation(tmp_path,"review")["status"])
