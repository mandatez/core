"""AgentEvent schema and signed-event construction.

The ``AgentEvent`` shape is canonical across every MandateZ surface
(Python SDK, TypeScript SDK, compliance engine, directory, consumer
dashboard). Do not rename fields.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from .signing import sign_event

__all__ = ["ACTION_TYPES", "OUTCOMES", "AgentEvent", "create_signed_event"]

ActionType = Literal["read", "write", "export", "delete", "call", "payment"]
Outcome = Literal["allowed", "blocked", "flagged", "pending_approval"]

ACTION_TYPES: tuple[ActionType, ...] = (
    "read",
    "write",
    "export",
    "delete",
    "call",
    "payment",
)
OUTCOMES: tuple[Outcome, ...] = (
    "allowed",
    "blocked",
    "flagged",
    "pending_approval",
)


@dataclass
class AgentEvent:
    """A signed, tamper-evident record of a single agent action."""

    event_id: str
    agent_id: str
    owner_id: str
    timestamp: str
    action_type: ActionType
    resource: str
    outcome: Outcome
    policy_id: Optional[str]
    metadata: Dict[str, Any]
    signature: str
    public_key: str

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "AgentEvent":
        return cls(
            event_id=raw["event_id"],
            agent_id=raw["agent_id"],
            owner_id=raw["owner_id"],
            timestamp=raw["timestamp"],
            action_type=raw["action_type"],
            resource=raw["resource"],
            outcome=raw["outcome"],
            policy_id=raw.get("policy_id"),
            metadata=raw.get("metadata") or {},
            signature=raw["signature"],
            public_key=raw["public_key"],
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "agent_id": self.agent_id,
            "owner_id": self.owner_id,
            "timestamp": self.timestamp,
            "action_type": self.action_type,
            "resource": self.resource,
            "outcome": self.outcome,
            "policy_id": self.policy_id,
            "metadata": self.metadata or {},
            "signature": self.signature,
            "public_key": self.public_key,
        }


def _validate_required(action_type: str, outcome: str, agent_id: str, owner_id: str, resource: str) -> None:
    if action_type not in ACTION_TYPES:
        raise ValueError(
            f"action_type must be one of {ACTION_TYPES}, got {action_type!r}"
        )
    if outcome not in OUTCOMES:
        raise ValueError(f"outcome must be one of {OUTCOMES}, got {outcome!r}")
    if not agent_id.startswith("ag_"):
        raise ValueError(f"agent_id must start with 'ag_' prefix, got {agent_id!r}")
    if not owner_id:
        raise ValueError("owner_id is required")
    if not resource:
        raise ValueError("resource is required")


def create_signed_event(
    *,
    agent_id: str,
    owner_id: str,
    action_type: ActionType,
    resource: str,
    outcome: Outcome = "allowed",
    policy_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    private_key: str,
) -> AgentEvent:
    """Produce a fully-signed :class:`AgentEvent`.

    Event ID and timestamp are generated here; everything else is
    caller-supplied. The returned dict-compatible form is what the
    dashboard and TypeScript SDK will verify against.
    """
    _validate_required(action_type, outcome, agent_id, owner_id, resource)

    unsigned: Dict[str, Any] = {
        "event_id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "owner_id": owner_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "action_type": action_type,
        "resource": resource,
        "outcome": outcome,
        "policy_id": policy_id,
        "metadata": metadata or {},
    }

    signed = sign_event(unsigned, private_key)
    return AgentEvent.from_dict(signed)
