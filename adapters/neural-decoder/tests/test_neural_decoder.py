import sys
from pathlib import Path
import pytest

# Add parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from decoder import NeuroIntentDecoder, generate_alpha_wave


def test_extract_features_returns_alpha_power():
    """Test 1: extract_features returns dictionary containing 'alpha_power' key."""
    decoder = NeuroIntentDecoder(sampling_rate=256)
    samples = generate_alpha_wave(sampling_rate=256, duration=1.0, alpha_freq=10.0)
    features = decoder.extract_features(samples)

    assert isinstance(features, dict)
    assert "alpha_power" in features
    assert isinstance(features["alpha_power"], float)
    assert features["alpha_power"] > 0.0


def test_decode_returns_neuro_intent_with_required_fields():
    """Test 2: decode returns NeuroIntent dictionary matching schema with all required fields."""
    decoder = NeuroIntentDecoder(sampling_rate=256)
    samples = generate_alpha_wave(sampling_rate=256, duration=1.0, alpha_freq=10.0)
    intent = decoder.decode(samples)

    required_fields = ["id", "source", "intent", "confidence", "features", "timestamp", "requiresConfirmation"]
    for field in required_fields:
        assert field in intent, f"Field '{field}' missing from NeuroIntent output"

    assert intent["source"] in ("eeg", "mock", "audio", "bci", "egeg")
    assert 0.0 <= intent["confidence"] <= 1.0
    assert isinstance(intent["timestamp"], (int, float))
    assert isinstance(intent["requiresConfirmation"], bool)
    assert isinstance(intent["features"], dict)


def test_alpha_wave_has_peak_in_8_12_hz_band():
    """Test 3: 256-point synthetic alpha wave (10 Hz) has peak frequency in the 8-12 Hz band."""
    samples = generate_alpha_wave(sampling_rate=256, duration=1.0, alpha_freq=10.0)
    decoder = NeuroIntentDecoder(sampling_rate=256)
    features = decoder.extract_features(samples)

    peak_freq = features.get("peak_frequency", 0.0)
    assert 8.0 <= peak_freq <= 12.0, f"Expected peak frequency in 8-12 Hz band, got {peak_freq} Hz"
