# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

from pathlib import Path

from jinja2.sandbox import ImmutableSandboxedEnvironment


def _render(template: str, *, preserve_thinking: bool = False) -> str:
    environment = ImmutableSandboxedEnvironment(trim_blocks = True, lstrip_blocks = True)
    environment.globals["raise_exception"] = lambda message: (_ for _ in ()).throw(
        ValueError(message)
    )
    return environment.from_string(template).render(
        messages = [
            {"role": "user", "content": "Question"},
            {
                "role": "assistant",
                "content": "<|channel>thought\nHidden rationale\n<channel|>Final answer",
            },
        ],
        add_generation_prompt = False,
        preserve_thinking = preserve_thinking,
        enable_thinking = preserve_thinking,
    )


def test_gemma4_training_can_preserve_explicit_reasoning_targets():
    from unsloth.chat_templates import gemma4_thinking_template

    rendered = _render(gemma4_thinking_template, preserve_thinking = True)
    assert "Hidden rationale" in rendered
    assert "<|channel>thought" in rendered
    assert "<|think|>" in rendered
    assert "Final answer" in rendered


def test_gemma4_inference_default_still_strips_prior_reasoning():
    from unsloth.chat_templates import gemma4_thinking_template

    rendered = _render(gemma4_thinking_template)
    assert "Hidden rationale" not in rendered
    assert "Final answer" in rendered


def test_studio_dataset_formatting_requests_reasoning_preservation():
    backend = Path(__file__).resolve().parent.parent
    source = (backend / "utils/datasets/chat_templates.py").read_text(encoding = "utf-8")
    call = source[source.index("text = tokenizer.apply_chat_template(") :]
    call = call[: call.index(")") + 1]
    assert "preserve_thinking = preserve_reasoning" in call
    assert "enable_thinking = preserve_reasoning" in call


def test_reasoning_preservation_request_is_opt_in():
    from models.training import TrainingStartRequest

    base = {
        "model_name": "google/gemma-4-26B-A4B-it",
        "training_type": "LoRA/QLoRA",
        "format_type": "sharegpt",
    }
    assert TrainingStartRequest(**base).preserve_reasoning is False
    assert TrainingStartRequest(**base, preserve_reasoning = True).preserve_reasoning is True


def test_worker_passes_reasoning_option_into_dataset_formatting():
    backend = Path(__file__).resolve().parent.parent
    source = (backend / "core/training/worker.py").read_text(encoding = "utf-8")
    assert 'preserve_reasoning = config.get("preserve_reasoning", False)' in source


def test_quantized_gemma4_variant_inherits_thinking_template():
    from utils.datasets.chat_templates import resolve_model_chat_template

    assert (
        resolve_model_chat_template(
            "unsloth/gemma-4-26B-A4B-it-qat-q4_0-unquantized"
        )
        == "gemma-4-thinking"
    )
