import asyncio
import json

import httpx
import pytest

from core.inference import external_provider as ep
from core.inference.external_provider import ExternalProviderClient
from routes import providers


@pytest.mark.parametrize("selection,expected", [(None, {}), ("", {"enable_rvc": False}),
    ("Alice", {"enable_rvc": True, "rvc_model": "Alice"})])
def test_rvc_selection_reaches_voiceforge_without_altering_server_settings(monkeypatch, selection, expected):
    sent = []
    def handler(request):
        sent.append(request)
        return httpx.Response(200, content=b"audio", headers={"content-type": "audio/mpeg"})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport:
            monkeypatch.setattr(ep, "_http_client", transport)
            client = ExternalProviderClient("voiceforge", "http://127.0.0.1:8889", "")
            await client.create_speech("hello", "kokoro", "bf_emma", response_format="mp3", voiceforge_rvc_model=selection)
    asyncio.run(run())
    body = json.loads(sent[0].content)
    assert {key: body[key] for key in ("enable_rvc", "rvc_model") if key in body} == expected
    assert sent[0].url.path == "/v1/audio/speech"


def test_options_proxy_uses_saved_connection_and_returns_discovered_models(monkeypatch):
    monkeypatch.setattr(providers.providers_db, "get_provider", lambda _: {
        "provider_type": "voiceforge", "is_enabled": True, "base_url": "http://127.0.0.1:8889"})
    monkeypatch.setattr(providers, "resolve_provider_api_key_or_400", lambda *a, **k: "")
    options = {"speech_models": [{"id": "kokoro", "voices": ["bf_emma"]}],
               "recognition_models": ["whisper-large-v3-turbo"], "rvc_models": ["Alice"]}
    def handler(request):
        assert request.url.path == "/v1/audio/options"
        assert "authorization" not in request.headers
        return httpx.Response(200, json=options)
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport:
            monkeypatch.setattr(ep, "_http_client", transport)
            assert await providers.voiceforge_options("connection", via_api_key=False) == options
    asyncio.run(run())


def test_rvc_options_cannot_be_sent_to_another_provider():
    client = ExternalProviderClient("custom", "http://127.0.0.1:8889/v1", "")
    with pytest.raises(ValueError, match="VoiceForge"):
        asyncio.run(client.create_speech("hi", "model", voiceforge_rvc_model="Alice"))
