"""Background uploads use the private avatar library and validate actual image bytes."""
from io import BytesIO

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from routes import companion


@pytest.fixture
def library(tmp_path, monkeypatch):
    app = FastAPI()
    app.include_router(companion.router, prefix="/api/companion")
    app.dependency_overrides[companion.get_current_subject] = lambda: "owner"
    monkeypatch.setattr(companion, "assets_root", lambda: tmp_path)
    monkeypatch.setattr(companion, "is_owner_context", lambda: True)
    return TestClient(app), tmp_path


def test_image_upload_is_listed_and_uses_generated_filename(library):
    client, root = library
    image = BytesIO()
    Image.new("RGB", (8, 8), "purple").save(image, format="PNG")
    response = client.post("/api/companion/backgrounds", files={"file": ("../../escape.html", image.getvalue(), "text/html")})
    assert response.status_code == 200
    url = response.json()["url"]
    assert url.startswith("/assets/backgrounds/") and url.endswith(".png")
    assert (root / url.removeprefix("/assets/")).read_bytes() == image.getvalue()
    assert client.get("/api/companion/assets").json()["backgrounds"][0]["url"] == url


@pytest.mark.parametrize("content", [b"<svg></svg>", b"<html>not an image</html>", b"\x89PNG\r\n\x1a\n"])
def test_invalid_images_are_rejected_without_files(library, content):
    client, root = library
    assert client.post("/api/companion/backgrounds", files={"file": ("image.png", content, "image/png")}).status_code == 400
    assert not list(root.rglob("*"))


def test_managed_account_cannot_upload_owner_backgrounds(library, monkeypatch):
    client, root = library
    monkeypatch.setattr(companion, "is_owner_context", lambda: False)
    assert client.post("/api/companion/backgrounds", files={"file": ("image.png", b"x")}).status_code == 403
    assert not list(root.rglob("*"))


def test_oversized_upload_is_rejected(library):
    client, root = library
    assert client.post("/api/companion/backgrounds", files={"file": ("image.png", b"x" * (20 * 1024 * 1024 + 1))}).status_code == 413
    assert not list(root.rglob("*"))
