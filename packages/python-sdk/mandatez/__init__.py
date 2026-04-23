"""MandateZ — Trust infrastructure for AI agents.

Every agent needs a mandate: a cryptographically signed identity,
a runtime policy that decides what it can and cannot do, and a
tamper-proof log of everything it has done.

This package ships the Python SDK for MandateZ. Events signed here
use the same Ed25519 canonical form as :code:`@mandatez/sdk` on npm,
so a Python-signed event verifies from TypeScript and vice versa.
"""

from .client import MandateZClient
from .events import (
    ACTION_TYPES,
    OUTCOMES,
    AgentEvent,
    create_signed_event,
)
from .hibp import (
    HibpBreach,
    IdentityCheckResult,
    check_identity,
    score_breaches,
)
from .identity import AgentIdentity, generate_agent_identity
from .policy import (
    Policy,
    PolicyEngine,
    PolicyEvaluation,
    PolicyRule,
    match_resource,
)
from .signing import canonicalize, sign_event, verify_event
from .trust import TrustProfile, compute_trust_score

__all__ = [
    # client
    "MandateZClient",
    # identity
    "AgentIdentity",
    "generate_agent_identity",
    # events
    "ACTION_TYPES",
    "OUTCOMES",
    "AgentEvent",
    "create_signed_event",
    # signing
    "canonicalize",
    "sign_event",
    "verify_event",
    # policy
    "Policy",
    "PolicyEngine",
    "PolicyEvaluation",
    "PolicyRule",
    "match_resource",
    # identity intelligence (HIBP)
    "HibpBreach",
    "IdentityCheckResult",
    "check_identity",
    "score_breaches",
    # trust
    "TrustProfile",
    "compute_trust_score",
]

__version__ = "0.1.0"
