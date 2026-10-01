"""Editor view state and owner directory browser; projects and tools remain Studio-owned."""
import asyncio
import os
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth.authentication import get_current_subject
from utils.account_context import is_owner_context
from storage.studio_db import get_app_setting, upsert_app_settings

router = APIRouter(dependencies=[Depends(get_current_subject)])

class ViewState(BaseModel):
    patch: dict[str, Any] = Field(default_factory=dict)

@router.get("/state")
async def get_state():
    return {"state": await asyncio.to_thread(get_app_setting, "code_editor_view", {})}

@router.patch("/state")
async def save_state(body: ViewState):
    import json
    if len(json.dumps(body.patch)) > 3_000_000:
        raise HTTPException(413, "Editor view state is too large")
    await asyncio.to_thread(upsert_app_settings, {"code_editor_view": body.patch})
    return {"state": body.patch}

@router.get("/directories")
async def directories(path: str = ""):
    if not is_owner_context():
        raise HTTPException(403, "Host folders require the Studio owner account")
    def listing():
        if not path and os.name == "nt":
            return {"path": "", "parent": "", "directories": [f"{c}:\\" for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if Path(f"{c}:\\").is_dir()]}
        folder = Path(path or str(Path.home())).expanduser()
        if not folder.is_absolute() or not folder.is_dir():
            raise HTTPException(400, "Choose an existing absolute directory")
        try:
            children = sorted(str(p) for p in folder.iterdir() if p.is_dir() and not p.is_symlink())[:1000]
        except PermissionError:
            raise HTTPException(403, "Cannot read this directory") from None
        return {"path": str(folder), "parent": str(folder.parent) if folder.parent != folder else "", "directories": children}
    return await asyncio.to_thread(listing)
