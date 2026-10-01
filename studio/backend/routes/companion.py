# SPDX-License-Identifier: AGPL-3.0-only
"""Studio-owned settings and private assets for the adapted ErisHub presentation."""
import asyncio
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from auth.authentication import get_current_subject, subject_for_header_or_query_token
from storage.studio_db import get_app_setting, upsert_app_settings
from utils.account_context import is_owner_context

router = APIRouter()
SETTINGS_KEY = "companion_presentation"


class CompanionSettings(BaseModel):
    vrm: dict[str, Any] = Field(default_factory=dict)
    hypno: dict[str, Any] = Field(default_factory=dict)
    profiles: list[dict[str, Any]] = Field(default_factory=list, max_length=100)


@router.get("/settings")
async def settings(subject: str = Depends(get_current_subject)):
    return await asyncio.to_thread(get_app_setting, SETTINGS_KEY, {"vrm": {}, "hypno": {}})


@router.put("/settings")
async def save_settings(body: CompanionSettings, subject: str = Depends(get_current_subject)):
    value = body.model_dump()
    import json
    if len(json.dumps(value)) > 256_000:
        raise HTTPException(413, "Companion settings are too large")
    await asyncio.to_thread(upsert_app_settings, {SETTINGS_KEY: value})
    return value


def assets_root():
    # These are installation-owned avatar assets; account data stays in Studio's scoped DB.
    return Path.home() / ".unsloth" / "companion" / "assets"


@router.post("/backgrounds")
async def upload_background(file: UploadFile = File(...), subject: str = Depends(get_current_subject)):
    if not is_owner_context():
        raise HTTPException(403, "Owner avatar library")
    data = await file.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(413, "Background images must be 20 MB or smaller")
    # Decode before accepting; never serve uploaded HTML/SVG as an image.
    from PIL import Image, UnidentifiedImageError
    from io import BytesIO
    from uuid import uuid4
    def save():
        try:
            with Image.open(BytesIO(data)) as image:
                extension = {"PNG": ".png", "JPEG": ".jpg", "WEBP": ".webp"}.get(image.format)
                if not extension or image.width * image.height > 40_000_000:
                    raise ValueError("Use a PNG, JPEG or WebP image up to 40 megapixels")
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
            raise HTTPException(400, "Use a valid PNG, JPEG or WebP image up to 40 megapixels") from exc
        root = assets_root() / "backgrounds"
        root.mkdir(parents=True, exist_ok=True)
        name = uuid4().hex + extension
        (root / name).write_bytes(data)
        return {"url": "/assets/backgrounds/" + name}
    return await asyncio.to_thread(save)


@router.get("/assets")
async def assets(subject: str = Depends(get_current_subject)):
    if not is_owner_context():
        raise HTTPException(403, "Owner avatar library")
    def inventory():
        root = assets_root()
        groups = {"models": [], "animations": [], "backgrounds": []}
        for folder, key, suffixes in [("vrm/models", "models", {".vrm", ".fbx"}), ("vrm/animations", "animations", {".bvh", ".fbx", ".vrma", ".vmd"}), ("backgrounds", "backgrounds", {".png", ".jpg", ".webp", ".mp4", ".webm"})]:
            for file in sorted((root / folder).rglob("*")):
                if file.is_file() and file.suffix.lower() in suffixes and not file.is_symlink():
                    groups[key].append({"name": file.stem, "url": "/assets/" + file.relative_to(root).as_posix()})
        return groups
    return await asyncio.to_thread(inventory)


@router.api_route("/assets/{name:path}", methods=["GET", "HEAD"])
async def asset(name: str, request: Request, token: str | None = None):
    await subject_for_header_or_query_token(request, token)
    if not is_owner_context():
        raise HTTPException(403, "Owner avatar library")
    root = assets_root().resolve()
    path = (root / name).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(404, "Asset not found")
    return FileResponse(path, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
