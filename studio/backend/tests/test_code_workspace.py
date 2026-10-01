from pathlib import Path
import subprocess

import pytest
from fastapi import HTTPException
from core.code_workspace import checked_path, read_file, save_file, git_operation


def test_roundtrip_conflict_and_new_file_collision(tmp_path):
    result = save_file(tmp_path, "src/demo.py", "print('hello')\r\n", None)
    assert read_file(tmp_path, "src/demo.py") == result
    with pytest.raises(HTTPException) as conflict:
        save_file(tmp_path, "src/demo.py", "replace", None)
    assert conflict.value.status_code == 409
    (tmp_path / "src/demo.py").write_text("external edit", encoding="utf-8")
    with pytest.raises(HTTPException) as conflict:
        save_file(tmp_path, "src/demo.py", "replace", result["revision"])
    assert conflict.value.status_code == 409
    assert (tmp_path / "src/demo.py").read_text() == "external edit"


@pytest.mark.parametrize("name", ["../escape", "/absolute", "C:/outside", "x:ads", "a/../../b", ".git/config", ".unsloth_sandbox_remap.json", "CON", "dir/NUL.txt", "file.", "file "])
def test_rejects_unsafe_paths(tmp_path, name):
    with pytest.raises(HTTPException):
        save_file(tmp_path, name, "no", None)


def test_binary_and_missing_files(tmp_path):
    (tmp_path / "binary").write_bytes(b"a\0b")
    with pytest.raises(HTTPException) as error:
        read_file(tmp_path, "binary")
    assert error.value.status_code == 415
    with pytest.raises(HTTPException) as error:
        read_file(tmp_path, "missing")
    assert error.value.status_code == 404


def test_separate_workspaces(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    save_file(a, "same.txt", "account a", None)
    save_file(b, "same.txt", "account b", None)
    assert read_file(a, "same.txt")["content"] == "account a"
    assert read_file(b, "same.txt")["content"] == "account b"


def test_link_escape(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    root = tmp_path / "root"
    root.mkdir()
    try:
        (root / "link").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("Host does not permit test symlinks")
    with pytest.raises(HTTPException):
        checked_path(root, "link/file.txt")


def git(root, *args):
    return subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


def test_git_review_stage_unstage_and_commit(tmp_path):
    git(tmp_path, "init")
    git(tmp_path, "config", "user.name", "Editor test")
    git(tmp_path, "config", "user.email", "editor@example.invalid")
    git(tmp_path, "config", "commit.gpgSign", "false")
    save_file(tmp_path, "hello.txt", "one\n", None)
    assert git_operation(tmp_path, "status")["files"] == [{"status": "??", "path": "hello.txt"}]
    git_operation(tmp_path, "stage", "hello.txt")
    git_operation(tmp_path, "unstage", "hello.txt")
    assert git_operation(tmp_path, "status")["files"][0]["status"] == "??"
    git_operation(tmp_path, "stage", "hello.txt")
    assert "+one" in git_operation(tmp_path, "diff", "hello.txt")["staged"]
    git_operation(tmp_path, "commit", message="First file")
    assert git_operation(tmp_path, "status")["files"] == []
    prior = read_file(tmp_path, "hello.txt")
    save_file(tmp_path, "hello.txt", "two\n", prior["revision"])
    assert "+two" in git_operation(tmp_path, "diff", "hello.txt")["output"]
    git_operation(tmp_path, "stage", "hello.txt")
    git_operation(tmp_path, "unstage", "hello.txt")
    assert git_operation(tmp_path, "status")["files"][0]["status"] == " M"


def test_git_never_uses_parent_repository(tmp_path):
    git(tmp_path, "init")
    nested = tmp_path / "workspace"
    nested.mkdir()
    assert git_operation(nested, "status") == {"repository": False, "files": []}
    with pytest.raises(HTTPException):
        git_operation(nested, "commit", message="No")


def test_registered_route_auth_validation_and_roundtrip(tmp_path):
    """Execute the actual route/model without importing the inference engines."""
    import ast
    from typing import Literal, Optional
    from fastapi import APIRouter, FastAPI, Request
    from fastapi.testclient import TestClient

    source = ast.parse((Path(__file__).parents[1] / "routes/inference.py").read_text(encoding="utf-8"))
    nodes = [node for node in source.body if (
        isinstance(node, ast.ImportFrom) and node.module == "pydantic"
    ) or getattr(node, "name", "") in {"CodeWorkspaceRequest", "code_workspace_action"}]
    resolved = []

    async def authenticate(request, token):
        if request.headers.get("authorization") != "Bearer test-owner":
            raise HTTPException(401, "Unauthorized")

    def root(session, create=False):
        resolved.append(session)
        assert session == "test-thread"
        return str(tmp_path)

    namespace = {"studio_router": APIRouter(), "Literal": Literal, "Optional": Optional,
                 "Request": Request, "HTTPException": HTTPException,
                 "_authenticate_header_or_query": authenticate, "_sandbox_dir_for": root,
                 "is_owner_context": lambda: True,
                 "_contained_sandbox_path": lambda session, name: (tmp_path, checked_path(tmp_path, name))}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "editor-route", "exec"), namespace)
    app = FastAPI()
    app.include_router(namespace["studio_router"])
    with TestClient(app) as client:
        payload = {"session_id": "test-thread", "action": "save", "filename": "test.txt", "content": "hello"}
        assert client.post("/code-workspace", json=payload).status_code == 401
        assert resolved == []
        client.headers["Authorization"] = "Bearer test-owner"
        assert client.post("/code-workspace", json={**payload, "action": "shell"}).status_code == 422
        saved = client.post("/code-workspace", json=payload)
        assert saved.status_code == 200
        assert client.post("/code-workspace", json={**payload, "action": "read"}).json() == saved.json()
        assert client.post("/code-workspace", json=payload).status_code == 409
        namespace["is_owner_context"] = lambda: False
        assert client.post("/code-workspace", json={**payload, "action": "status"}).status_code == 403
