# SPDX-License-Identifier: AGPL-3.0-only
"""Text editing and Git operations inside an already resolved Studio workspace."""
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import threading

from fastapi import HTTPException

MAX_TEXT_BYTES = 2 * 1024 * 1024
_locks = [threading.RLock() for _ in range(64)]


def _lock(root):
    return _locks[hash(os.path.normcase(str(root))) % len(_locks)]


def checked_path(root, name):
    root = Path(root).resolve()
    parts = name.replace("\\", "/").split("/")
    if not parts or any(
        not p or p in (".", "..") or ":" in p or p.endswith((".", " "))
        or any(ord(c) < 32 for c in p) or p.lower() == ".git"
        or p.lower().startswith(".unsloth")
        or p.split(".")[0].upper() in {"CON", "PRN", "AUX", "NUL", *[f"COM{i}" for i in range(1, 10)], *[f"LPT{i}" for i in range(1, 10)]}
        for p in parts
    ):
        raise HTTPException(400, "Use a relative workspace filename, excluding internal files.")
    path = root
    for part in parts:
        path = path / part
        if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
            raise HTTPException(403, "Linked paths cannot be edited.")
    if not path.resolve().is_relative_to(root):
        raise HTTPException(403, "Path is outside the workspace.")
    return path


def _read(path):
    try:
        with path.open("rb") as f:
            if not stat.S_ISREG(os.fstat(f.fileno()).st_mode):
                raise HTTPException(400, "Choose a regular text file.")
            raw = f.read(MAX_TEXT_BYTES + 1)
    except FileNotFoundError:
        raise HTTPException(404, "File not found.") from None
    except (IsADirectoryError, PermissionError):
        raise HTTPException(400, "Choose an accessible regular text file.") from None
    if len(raw) > MAX_TEXT_BYTES or b"\0" in raw:
        raise HTTPException(415, "The editor supports UTF-8 text files up to 2 MiB.")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, "This file is not UTF-8 text.") from None
    return {"content": content, "revision": hashlib.sha256(raw).hexdigest()}


def read_file(root, name):
    with _lock(root):
        path = checked_path(root, name)
        result = _read(path)
        checked_path(root, name)
        return result


def save_file(root, name, content, revision):
    raw = content.encode("utf-8")
    if len(raw) > MAX_TEXT_BYTES or b"\0" in raw:
        raise HTTPException(415, "The editor supports UTF-8 text files up to 2 MiB.")
    with _lock(root):
        path = checked_path(root, name)
        exists = path.exists()
        if (exists and (revision is None or _read(path)["revision"] != revision)) or (not exists and revision is not None):
            raise HTTPException(409, "File changed on disk. Reopen it to review before saving.")
        path.parent.mkdir(parents=True, exist_ok=True)
        checked_path(root, name)
        fd, tmp = tempfile.mkstemp(prefix=".unsloth-editor-", dir=path.parent)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(raw)
                f.flush()
                os.fsync(f.fileno())
            if exists:
                os.chmod(tmp, stat.S_IMODE(path.stat().st_mode))
            checked_path(root, name)
            if (path.exists() != exists) or (exists and _read(path)["revision"] != revision):
                raise HTTPException(409, "File changed while saving. Reopen it to review.")
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
        return {"content": content, "revision": hashlib.sha256(raw).hexdigest()}


def git_operation(root, action, name=None, message=None):
    root = Path(root).resolve()
    git_dir = root / ".git"
    # Never let Git discover an ancestor repository or follow external Git metadata.
    if action != "init" and (not git_dir.is_dir() or git_dir.is_symlink() or (hasattr(git_dir, "is_junction") and git_dir.is_junction())):
        if action == "status":
            return {"repository": False, "files": []}
        raise HTTPException(400, "This Studio workspace is not a Git repository.")
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_TERMINAL_PROMPT="0", GIT_LITERAL_PATHSPECS="1")

    def run(*args, allow_failure=False):
        try:
            result = subprocess.run(
                ["git", "-C", str(root), *args],
                capture_output=True, timeout=20, env=env,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise HTTPException(400, f"Git unavailable or timed out: {error}") from None
        if result.returncode:
            if allow_failure:
                return ""
            raise HTTPException(400, result.stderr.decode("utf-8", "replace")[:2000] or "Git operation failed.")
        if len(result.stdout) > MAX_TEXT_BYTES:
            raise HTTPException(413, "Git output is too large to display.")
        return result.stdout.decode("utf-8", "replace")

    with _lock(root):
        if action == "init":
            return {"output": run("init")}
        if action == "review":
            entries = run("status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all")
            return {"isRepo": True, "branch": run("branch", "--show-current").strip(), "status": [{"x": line[0], "y": line[1], "path": line[3:]} for line in entries.split("\0") if line], "stagedDiff": run("diff", "--cached", "--no-ext-diff", "--no-textconv"), "unstagedDiff": run("diff", "--no-ext-diff", "--no-textconv")}
        if action == "status":
            entries = run("status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all")
            return {"repository": True, "files": [{"status": line[:2], "path": line[3:]} for line in entries.split("\0") if line]}
        if action == "commit":
            if not message or not message.strip() or len(message) > 4000:
                raise HTTPException(400, "Enter a commit message (up to 4000 characters).")
            return {"output": run("commit", "-m", message)}
        if not name:
            raise HTTPException(400, "Choose a file.")
        checked_path(root, name)
        if action == "ignore":
            path = checked_path(root, ".gitignore")
            previous = _read(path) if path.exists() else None
            # Escape Git ignore pattern metacharacters so this targets the selected path.
            escaped = "".join("\\" + c if c in "\\*?[]!# " else c for c in name.replace("\\", "/"))
            content = (previous["content"].rstrip("\n") + "\n" if previous else "") + "/" + escaped + "\n"
            return save_file(root, ".gitignore", content, previous["revision"] if previous else None)
        if action == "diff":
            return {"output": run("diff", "--no-ext-diff", "--no-textconv", "--", name), "staged": run("diff", "--cached", "--no-ext-diff", "--no-textconv", "--", name)}
        if action == "stage":
            return {"output": run("add", "--", name)}
        if action == "unstage":
            # Works before the first commit as well as in an existing repository.
            if run("rev-parse", "--verify", "--quiet", "HEAD", allow_failure=True):
                return {"output": run("reset", "-q", "HEAD", "--", name)}
            return {"output": run("rm", "--cached", "--", name)}
        raise HTTPException(400, "Unsupported Git action.")
