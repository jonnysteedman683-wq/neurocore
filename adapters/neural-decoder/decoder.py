import cmath
import math
import time
import uuid
from typing import Any, Dict, List


def radix2_dit_fft(x: List[complex]) -> List[complex]:
    """Radix-2 Decimation-In-Time Fast Fourier Transform (pure Python)."""
    N = len(x)
    if N <= 1:
        return x
    
    # Pad to nearest power of 2 if necessary
    if (N & (N - 1)) != 0:
        next_pow2 = 1 << (N - 1).bit_length()
        x = x + [complex(0, 0)] * (next_pow2 - N)
        N = next_pow2

    even = radix2_dit_fft(x[0::2])
    odd = radix2_dit_fft(x[1::2])
    
    T = [cmath.exp(-2j * math.pi * k / N) * odd[k] for k in range(N // 2)]
    return [even[k] + T[k] for k in range(N // 2)] + [even[k] - T[k] for k in range(N // 2)]


def generate_alpha_wave(sampling_rate: int = 256, duration: float = 1.0, alpha_freq: float = 10.0) -> List[float]:
    """Generates a 256-point synthetic EEG signal with dominant alpha wave activity."""
    num_samples = int(sampling_rate * duration)
    samples = []
    for i in range(num_samples):
        t = i / sampling_rate
        # Primary alpha wave at alpha_freq (e.g. 10 Hz) + subtle harmonic
        signal = math.sin(2 * math.pi * alpha_freq * t) + 0.15 * math.sin(2 * math.pi * (alpha_freq * 2) * t)
        samples.append(signal)
    return samples


class NeuroIntentDecoder:
    """Neural Intent Decoder stub for extracting EEG spectral features and producing NeuroIntents."""

    def __init__(self, sampling_rate: int = 256):
        self.sampling_rate = sampling_rate

    def extract_features(self, samples: List[float]) -> Dict[str, Any]:
        """Performs spectral analysis using radix-2 FFT to compute EEG band powers."""
        N = len(samples)
        if N == 0:
            return {"alpha_power": 0.0, "beta_power": 0.0, "theta_power": 0.0, "peak_frequency": 0.0, "total_power": 0.0}

        complex_samples = [complex(s, 0) for s in samples]
        fft_result = radix2_dit_fft(complex_samples)
        num_fft = len(fft_result)

        # Compute magnitude spectrum (one-sided)
        freq_resolution = self.sampling_rate / num_fft
        half_n = num_fft // 2
        magnitudes = [abs(fft_result[i]) / num_fft for i in range(half_n)]

        alpha_power = 0.0
        beta_power = 0.0
        theta_power = 0.0
        total_power = sum(m ** 2 for m in magnitudes)

        peak_mag = 0.0
        peak_freq = 0.0

        for k, mag in enumerate(magnitudes):
            freq = k * freq_resolution
            power = mag ** 2

            if 4.0 <= freq < 8.0:
                theta_power += power
            elif 8.0 <= freq <= 13.0:
                alpha_power += power
            elif 13.0 < freq <= 30.0:
                beta_power += power

            if mag > peak_mag:
                peak_mag = mag
                peak_freq = freq

        return {
            "alpha_power": round(alpha_power, 6),
            "beta_power": round(beta_power, 6),
            "theta_power": round(theta_power, 6),
            "peak_frequency": round(peak_freq, 2),
            "total_power": round(total_power, 6),
        }

    def decode(self, samples: List[float]) -> Dict[str, Any]:
        """Decodes raw neural signal samples into a NeuroIntent matching neurocore contracts schema."""
        features = self.extract_features(samples)

        alpha_power = features.get("alpha_power", 0.0)
        total_power = features.get("total_power", 0.000001)

        # Basic heuristic for intent classification
        if features.get("peak_frequency", 0.0) >= 8.0 and features.get("peak_frequency", 0.0) <= 13.0:
            intent = "alpha_relaxation_focus"
            confidence = min(1.0, max(0.5, alpha_power / max(total_power, 0.0001)))
        elif features.get("peak_frequency", 0.0) > 13.0:
            intent = "beta_active_thought"
            confidence = 0.85
        else:
            intent = "idle_baseline"
            confidence = 0.60

        requires_confirmation = confidence < 0.9

        return {
            "id": f"intent-{uuid.uuid4().hex[:8]}",
            "source": "eeg",
            "intent": intent,
            "confidence": round(confidence, 4),
            "features": features,
            "timestamp": int(time.time() * 1000),
            "requiresConfirmation": requires_confirmation,
        }
