# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

"""Dedicated Transformers TTS runtime.

This intentionally owns a second InferenceBackend instance. It must never use
the chat singleton: loading, unloading, or generating speech cannot disturb the
conversation model.
"""

from __future__ import annotations

import threading
import io
import wave
import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

from loggers import get_logger

logger = get_logger(__name__)

_TTS_OUTPUT_TYPES = {"snac", "csm", "bicodec", "dac"}
_KOKORO_MODELS = {"onnx-community/Kokoro-82M-v1.0-ONNX"}
_POCKET_TTS_MODELS = {"KevinAHM/pocket-tts-onnx"}
_OMNIVOICE_MODELS = {"onnx-community/OmniVoice-Onnx"}


class TtsSidecar:
    def __init__(self) -> None:
        self._backend = None
        self._model_id: Optional[str] = None
        self._audio_type: Optional[str] = None
        self._runtime: Optional[str] = None
        self._lock = threading.RLock()
        self._loading = False

    def status(self) -> dict:
        with self._lock:
            return {
                "loaded_model": self._model_id,
                "audio_type": self._audio_type,
                "runtime": self._runtime,
                "loading": self._loading,
                "voices": self._voices(),
                "supports_reference_audio": self._audio_type in {"pocket_tts", "omnivoice"},
            }

    def _voices(self) -> list[str]:
        if self._audio_type == "kokoro":
            return ["af_bella", "af_heart", "af_nicole", "am_adam", "am_michael", "bf_emma", "bm_george"]
        if self._audio_type == "pocket_tts":
            voices = getattr(self._backend, "voices", None)
            if isinstance(voices, dict):
                return sorted(str(name) for name in voices)
            if isinstance(voices, (list, tuple, set)):
                return sorted(str(name) for name in voices)
            return ["alba"]
        return []

    def load(self, model_id: str, *, hf_token: Optional[str] = None) -> dict:
        from core.inference.inference import InferenceBackend
        from utils.models.model_config import ModelConfig

        with self._lock:
            self._loading = True
            try:
                if model_id in _KOKORO_MODELS:
                    return self._load_kokoro_locked(model_id, hf_token)
                if model_id in _POCKET_TTS_MODELS:
                    return self._load_pocket_tts_locked(model_id, hf_token)
                if model_id in _OMNIVOICE_MODELS:
                    return self._load_omnivoice_locked(model_id, hf_token)
                config = ModelConfig.from_identifier(model_id, hf_token = hf_token)
                if config is None or not config.is_audio or config.audio_type not in _TTS_OUTPUT_TYPES:
                    raise ValueError("Select a downloaded text-to-speech audio model.")
                if not config.is_cached and not config.is_local:
                    raise ValueError("Download the TTS model before loading it into the audio runtime.")
                if config.is_gguf:
                    raise ValueError("GGUF TTS models are not supported by the separate audio runtime yet.")

                self._release_locked()
                backend = InferenceBackend()
                if not backend.load_model(config, load_in_4bit = False, hf_token = hf_token):
                    raise RuntimeError("Could not load the TTS model.")
                self._backend = backend
                self._model_id = config.identifier
                self._audio_type = config.audio_type
                self._runtime = "transformers"
                logger.info("Loaded dedicated TTS runtime: %s", self._model_id)
                return self.status()
            finally:
                self._loading = False

    def _load_kokoro_locked(self, model_id: str, hf_token: Optional[str]) -> dict:
        """Load Kokoro's ONNX graph without touching the chat runtime."""
        try:
            from huggingface_hub import snapshot_download
            from kokoro_onnx import Kokoro
        except ImportError as exc:
            raise RuntimeError(
                "Kokoro support requires the kokoro-onnx package. Run the Studio updater."
            ) from exc

        path = snapshot_download(
            model_id,
            token = hf_token,
        )
        from pathlib import Path

        root = Path(path)
        model_path = next(iter(root.glob("onnx/model_q8f16.onnx")), None)
        if model_path is None:
            model_path = next(iter(root.glob("onnx/model*.onnx")), None)
        voices_path = next(iter(root.glob("voices/*.bin")), None)
        if model_path is None or voices_path is None:
            raise ValueError("The downloaded Kokoro model is missing its ONNX graph or voices.")
        self._release_locked()
        self._backend = Kokoro(str(model_path), str(voices_path))
        self._model_id = model_id
        self._audio_type = "kokoro"
        self._runtime = "onnx"
        return self.status()

    def _load_pocket_tts_locked(self, model_id: str, hf_token: Optional[str]) -> dict:
        """Load Pocket TTS's repository-provided ONNX adapter in this sidecar."""
        from huggingface_hub import snapshot_download
        from pathlib import Path

        root = Path(snapshot_download(model_id, token = hf_token))
        adapter_path = root / "pocket_tts_onnx.py"
        if not adapter_path.is_file():
            raise ValueError("The downloaded Pocket TTS model has no ONNX adapter.")
        spec = importlib.util.spec_from_file_location("unsloth_pocket_tts", adapter_path)
        if spec is None or spec.loader is None:
            raise RuntimeError("Could not load the Pocket TTS ONNX adapter.")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self._release_locked()
        self._backend = module.PocketTTSOnnx(
            models_dir = str(root / "onnx"),
            language = "english_2026-04",
        )
        self._model_id = model_id
        self._audio_type = "pocket_tts"
        self._runtime = "onnx"
        return self.status()

    def _load_omnivoice_locked(self, model_id: str, hf_token: Optional[str]) -> dict:
        """Register OmniVoice's own ONNX runtime without loading a chat model."""
        from huggingface_hub import snapshot_download

        root = Path(snapshot_download(model_id, token = hf_token))
        runner = root / "inference.py"
        model_dir = root / "onnx"
        higgs_dir = model_dir / "audio_tokenizer"
        if not runner.is_file() or not model_dir.is_dir() or not higgs_dir.is_dir():
            raise ValueError("The downloaded OmniVoice model is missing its ONNX inference runtime.")
        self._release_locked()
        self._backend = {"runner": runner, "model_dir": model_dir, "higgs_dir": higgs_dir}
        self._model_id = model_id
        self._audio_type = "omnivoice"
        self._runtime = "onnx"
        return self.status()

    def unload(self) -> dict:
        with self._lock:
            self._release_locked()
            return self.status()

    def _release_locked(self) -> None:
        backend = self._backend
        model_id = self._model_id
        self._backend = None
        self._model_id = None
        self._audio_type = None
        self._runtime = None
        if backend is not None and model_id and hasattr(backend, "unload_model"):
            try:
                backend.unload_model(model_id)
            except Exception:
                logger.exception("Failed to unload dedicated TTS runtime")

    def generate(self, text: str, voice: Optional[str] = None, reference_audio: Optional[str] = None, reference_text: Optional[str] = None) -> tuple[bytes, int]:
        with self._lock:
            if self._backend is None or self._model_id is None:
                raise RuntimeError("No TTS model is loaded in the audio runtime.")
            if self._runtime == "onnx" and self._audio_type == "kokoro":
                samples, sample_rate = self._backend.create(text, voice = voice or "af_bella")
                return self._wav_bytes(samples, sample_rate)
            if self._runtime == "onnx" and self._audio_type == "pocket_tts":
                samples = self._backend.generate(text, voice = self._reference_audio_path(reference_audio) or voice or "alba")
                return self._wav_bytes(samples, 24_000)
            if self._runtime == "onnx" and self._audio_type == "omnivoice":
                return self._generate_omnivoice(text, reference_audio, reference_text)
            return self._backend.generate_audio_response(text = text)

    @staticmethod
    def _reference_audio_path(value: Optional[str]) -> Optional[str]:
        if not value or not value.startswith("data:audio/"):
            return None
        import base64

        _, encoded = value.split(",", 1)
        path = Path(tempfile.gettempdir()) / "unsloth-tts-reference.wav"
        path.write_bytes(base64.b64decode(encoded))
        return str(path)

    def _generate_omnivoice(self, text: str, reference_audio: Optional[str], reference_text: Optional[str]) -> tuple[bytes, int]:
        with tempfile.TemporaryDirectory(prefix = "unsloth-omnivoice-") as tmp:
            output = Path(tmp) / "speech.wav"
            command = [
                sys.executable,
                str(self._backend["runner"]),
                "--model_dir",
                str(self._backend["model_dir"]),
                "--higgs_dir",
                str(self._backend["higgs_dir"]),
                "--text",
                text,
                "--output",
                str(output),
            ]
            reference_path = self._reference_audio_path(reference_audio)
            if reference_path and reference_text:
                command.extend(["--ref_audio", reference_path, "--ref_text", reference_text])
            result = subprocess.run(command, capture_output = True, text = True, timeout = 180)
            if result.returncode != 0 or not output.is_file():
                raise RuntimeError(result.stderr.strip() or "OmniVoice generation failed.")
            with wave.open(str(output), "rb") as wav:
                sample_rate = wav.getframerate()
            return output.read_bytes(), sample_rate

    @staticmethod
    def _wav_bytes(samples, sample_rate: int) -> tuple[bytes, int]:
        import numpy as np

        pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm)
        return output.getvalue(), sample_rate


_sidecar = TtsSidecar()


def get_tts_sidecar() -> TtsSidecar:
    return _sidecar
