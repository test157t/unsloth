# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

from collections.abc import Mapping
from typing import Any, Iterable


def training_batch_samples(result: Any) -> Iterable[Mapping]:
    """Normalize Transformers/Unsloth get_batch_samples return values."""
    samples = result[0] if isinstance(result, tuple) else result
    if isinstance(samples, Mapping):
        return (samples,)
    return (sample for sample in (samples or ()) if isinstance(sample, Mapping))


def training_batch_input_ids(batch: Mapping) -> Any:
    """Read token IDs from dicts and mapping types such as BatchEncoding."""
    return batch.get("input_ids")
