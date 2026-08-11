import sys
from pathlib import Path
import pytest

# Add parent directory to sys.path to import server and schemas
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import (
    neurocore_health,
    neurocore_capabilities,
    neurocore_start_swarm,
    neurocore_status,
    neurocore_emergency_stop,
    neurocore_audit_log,
    ACTIONS_STORE,
)


def test_neurocore_health():
    """Test 1: neurocore_health returns valid status, version, uptime, and connected adapters."""
    health = neurocore_health()
    assert health["status"] == "healthy"
    assert health["version"] == "1.0.0"
    assert "uptime_seconds" in health
    assert isinstance(health["connected_adapters"], list)
    assert "omni-swarm" in health["connected_adapters"]


def test_neurocore_capabilities():
    """Test 2: neurocore_capabilities returns registered adapters and capabilities."""
    caps = neurocore_capabilities()
    assert isinstance(caps, list)
    assert len(caps) > 0
    first = caps[0]
    assert first["adapter_id"] == "omni-swarm"
    assert "coordinator" in first["roles"]
    assert "planning" in first["phases"]
    assert first["supports_cancel"] is True


def test_neurocore_start_swarm_and_status():
    """Test 3: neurocore_start_swarm creates intent and returns confirmation-gated response."""
    start_res = neurocore_start_swarm(intent_str="route_neural_flow", confidence=0.95)
    assert start_res["requires_confirmation"] is True
    assert "confirmation_message" in start_res
    action_id = start_res["action_id"]
    assert action_id.startswith("act-")

    # Query status of created action
    status_res = neurocore_status(action_id)
    assert status_res["action_id"] == action_id
    assert status_res["intent"] == "route_neural_flow"
    assert status_res["status"] in ("queued", "pending_confirmation")


def test_neurocore_emergency_stop():
    """Test 4: neurocore_emergency_stop halts all adapters and updates pending actions."""
    # Create an action first
    start_res = neurocore_start_swarm(intent_str="test_stop", confidence=0.5)
    action_id = start_res["action_id"]

    # Trigger emergency stop
    stop_res = neurocore_emergency_stop()
    assert stop_res["requires_confirmation"] is True
    assert stop_res["stopped"] is True
    assert "omni-swarm" in stop_res["adapters_affected"]

    # Verify action status was updated to cancelled
    status_res = neurocore_status(action_id)
    assert status_res["status"] == "cancelled"

    # Check audit log contains emergency stop event
    logs = neurocore_audit_log(limit=10)
    assert len(logs) > 0
    assert any(log["action_type"] == "emergency_stop" for log in logs)
