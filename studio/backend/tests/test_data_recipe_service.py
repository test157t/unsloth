# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from types import ModuleType, SimpleNamespace

from core.data_recipe import service


def test_model_retry_patch_adds_500_and_preserves_existing_policy(monkeypatch) -> None:
    @dataclass(frozen = True)
    class FakeRetryConfig:
        max_retries: int = 3
        retryable_status_codes: frozenset[int] = field(
            default_factory = lambda: frozenset({502, 503, 504})
        )

    created = []
    resource_provider = ModuleType("data_designer.engine.resources.resource_provider")

    def create_model_registry(*_args, **_kwargs):
        registry = SimpleNamespace(retry_config = FakeRetryConfig())
        registry._retry_config = registry.retry_config
        created.append(registry)
        return registry

    resource_provider.create_model_registry = create_model_registry

    resources = ModuleType("data_designer.engine.resources")
    resources.resource_provider = resource_provider
    retry = ModuleType("data_designer.engine.models.clients.retry")
    retry.RetryConfig = FakeRetryConfig

    monkeypatch.setitem(sys.modules, resources.__name__, resources)
    monkeypatch.setitem(sys.modules, retry.__name__, retry)
    monkeypatch.setattr(service, "_MODEL_RETRY_PATCHED", False)

    service._apply_data_designer_model_retry_patch()
    patched_factory = resource_provider.create_model_registry
    registry = patched_factory()

    assert registry.retry_config.retryable_status_codes == frozenset({502, 503, 504})
    assert registry._retry_config.retryable_status_codes == frozenset({500, 502, 503, 504})
    assert registry._retry_config.max_retries == 3

    service._apply_data_designer_model_retry_patch()
    assert resource_provider.create_model_registry is patched_factory
    assert len(created) == 1
