import pytest
from pydantic import ValidationError
from models.training import TrainingStartRequest
from core.training.training import _build_training_worker_config


def request(**fields):
    return TrainingStartRequest(model_name="test/model", training_type="LoRA/QLoRA", format_type="alpaca", **fields)


def test_logging_interval_default_and_worker_propagation():
    assert request().logging_steps == 1
    legacy = request().model_dump()
    legacy.pop("logging_steps")
    assert _build_training_worker_config(legacy)["logging_steps"] == 1
    value = request(logging_steps=25)
    assert _build_training_worker_config(value.model_dump())["logging_steps"] == 25


@pytest.mark.parametrize("value", [0, -1, 0.5, True, "10", 1_000_001])
def test_logging_interval_rejects_invalid_values(value):
    with pytest.raises(ValidationError, match="logging_steps"):
        request(logging_steps=value)
