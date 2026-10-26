import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NeuroIntentModel(BaseModel):
    id: str
    source: str = "mock"
    intent: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    features: Dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)
    requiresConfirmation: bool = False


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    uptime_seconds: float
    connected_adapters: List[str]


class AdapterCapability(BaseModel):
    adapter_id: str
    name: str
    status: str
    roles: List[str]
    phases: List[str]
    supports_cancel: bool
    max_concurrency: int


class MutatingConfirmationResponse(BaseModel):
    requires_confirmation: bool = True
    confirmation_message: str
    action_id: str
    status: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ActionStatusResponse(BaseModel):
    action_id: str
    status: str
    intent: str
    logs: List[str] = Field(default_factory=list)
    updated_at: float = Field(default_factory=time.time)


class EmergencyStopResponse(BaseModel):
    requires_confirmation: bool = True
    confirmation_message: str
    stopped: bool
    adapters_affected: List[str]
    timestamp: float = Field(default_factory=time.time)


class AuditEvent(BaseModel):
    event_id: str
    timestamp: float
    action_type: str
    details: Dict[str, Any]
