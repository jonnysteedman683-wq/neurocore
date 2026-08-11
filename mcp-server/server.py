import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List

from mcp.server.fastmcp import FastMCP
from schemas import (
    ActionStatusResponse,
    AdapterCapability,
    AuditEvent,
    EmergencyStopResponse,
    HealthResponse,
    MutatingConfirmationResponse,
    NeuroIntentModel,
)

mcp = FastMCP("Neurocore Control Plane")

START_TIME = time.time()
BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "adapters.json"
SCHEMA_PATH = BASE_DIR / "contracts" / "neuro_intent.json"

# Control plane state
AUDIT_LOG: List[Dict[str, Any]] = []
ACTIONS_STORE: Dict[str, Dict[str, Any]] = {}
SYSTEM_STATUS = "healthy"


def _log_audit(action_type: str, details: Dict[str, Any]) -> None:
    event = {
        "event_id": f"evt-{uuid.uuid4().hex[:8]}",
        "timestamp": time.time(),
        "action_type": action_type,
        "details": details,
    }
    AUDIT_LOG.append(event)


def _load_adapters_config() -> List[Dict[str, Any]]:
    if not CONFIG_PATH.exists():
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        default_config = {
            "adapters": [
                {
                    "id": "omni-swarm",
                    "name": "OMNIBUS Swarm Adapter",
                    "status": "connected",
                    "endpoint": "C:/Users/jonny/OneDrive/Desktop/AQB/OMNIBUS/Nuerocore-swarm.ts",
                    "capabilities": {
                        "roles": ["coordinator", "executor", "observer", "debate-agent"],
                        "phases": ["planning", "execution", "verification", "debate"],
                        "supportsCancel": True,
                        "hardwareControl": False,
                        "maxConcurrency": 10
                    }
                }
            ]
        }
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2)
        return default_config["adapters"]

    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("adapters", [])
    except Exception:
        return []


@mcp.tool()
def neurocore_health() -> Dict[str, Any]:
    """Returns health status, version, uptime, and connected adapters."""
    adapters = _load_adapters_config()
    connected = [a["id"] for a in adapters if a.get("status") in ("connected", "healthy")]
    uptime = time.time() - START_TIME
    return HealthResponse(
        status=SYSTEM_STATUS,
        version="1.0.0",
        uptime_seconds=round(uptime, 2),
        connected_adapters=connected,
    ).model_dump()


@mcp.tool()
def neurocore_capabilities() -> List[Dict[str, Any]]:
    """Returns all registered swarm adapters and their capabilities."""
    adapters = _load_adapters_config()
    res = []
    for a in adapters:
        caps = a.get("capabilities", {})
        cap_model = AdapterCapability(
            adapter_id=a.get("id", "unknown"),
            name=a.get("name", "Unnamed Adapter"),
            status=a.get("status", "disconnected"),
            roles=caps.get("roles", []),
            phases=caps.get("phases", []),
            supports_cancel=caps.get("supportsCancel", True),
            max_concurrency=caps.get("maxConcurrency", 1),
        )
        res.append(cap_model.model_dump())
    return res


@mcp.tool()
def neurocore_start_swarm(intent_str: str, confidence: float = 1.0) -> Dict[str, Any]:
    """Creates a NeuroIntent, validates it, routes to adapters, and returns action IDs (confirmation-gated)."""
    intent_id = f"intent-{uuid.uuid4().hex[:8]}"
    requires_confirm = confidence < 0.9

    intent_model = NeuroIntentModel(
        id=intent_id,
        source="mock",
        intent=intent_str,
        confidence=confidence,
        features={"source_tool": "mcp-server"},
        timestamp=time.time(),
        requiresConfirmation=requires_confirm,
    )

    action_id = f"act-{uuid.uuid4().hex[:8]}"
    action_record = {
        "action_id": action_id,
        "intent_id": intent_id,
        "intent": intent_str,
        "status": "pending_confirmation" if requires_confirm else "queued",
        "logs": [f"Created action {action_id} from intent '{intent_str}'"],
        "created_at": time.time(),
    }
    ACTIONS_STORE[action_id] = action_record

    _log_audit("start_swarm", {
        "intent_str": intent_str,
        "confidence": confidence,
        "action_id": action_id,
    })

    response = MutatingConfirmationResponse(
        requires_confirmation=True,
        confirmation_message=f"Confirm execution of intent '{intent_str}' (confidence: {confidence}) on swarm adapters.",
        action_id=action_id,
        status=action_record["status"],
        details={
            "intent": intent_model.model_dump(),
            "routed_adapters": [a["id"] for a in _load_adapters_config()],
        },
    )
    return response.model_dump()


@mcp.tool()
def neurocore_status(action_id: str) -> Dict[str, Any]:
    """Returns the status and execution logs of a specific action."""
    if action_id not in ACTIONS_STORE:
        return ActionStatusResponse(
            action_id=action_id,
            status="not_found",
            intent="unknown",
            logs=["Action ID not found in control plane store"],
        ).model_dump()

    act = ACTIONS_STORE[action_id]
    return ActionStatusResponse(
        action_id=action_id,
        status=act["status"],
        intent=act["intent"],
        logs=act["logs"],
        updated_at=act["created_at"],
    ).model_dump()


@mcp.tool()
def neurocore_emergency_stop() -> Dict[str, Any]:
    """Stops all connected adapters and clears active queue (confirmation-gated)."""
    global SYSTEM_STATUS
    adapters = _load_adapters_config()
    affected = [a["id"] for a in adapters]

    for act in ACTIONS_STORE.values():
        if act["status"] in ("pending_confirmation", "queued", "in_progress"):
            act["status"] = "cancelled"
            act["logs"].append("Cancelled due to emergency stop")

    _log_audit("emergency_stop", {"affected_adapters": affected})

    response = EmergencyStopResponse(
        requires_confirmation=True,
        confirmation_message="EMERGENCY STOP requested. Confirm immediate shutdown of all connected swarm adapters.",
        stopped=True,
        adapters_affected=affected,
    )
    return response.model_dump()


@mcp.tool()
def neurocore_audit_log(limit: int = 50) -> List[Dict[str, Any]]:
    """Returns recent audit events up to limit."""
    return AUDIT_LOG[-limit:]


if __name__ == "__main__":
    mcp.run(transport="stdio")
