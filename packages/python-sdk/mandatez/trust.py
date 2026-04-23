"""Agent trust posture — mirrors ``@mandatez/sdk`` trust grades.

Grades::

    verified   — score >= 90
    high       — score >= 70
    medium     — score >= 40
    low        — score >= 15
    unverified — otherwise
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

__all__ = ["TrustGrade", "TrustProfile", "compute_trust_score", "grade_for_score"]

TrustGrade = Literal["unverified", "low", "medium", "high", "verified"]


@dataclass
class TrustProfile:
    agent_id: str
    trust_score: int  # 0-100
    trust_grade: TrustGrade
    total_events: int
    allowed_ratio: float
    flagged_ratio: float
    blocked_ratio: float
    human_approvals: int = 0
    human_rejections: int = 0
    first_seen: Optional[str] = None
    last_active: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "trust_score": self.trust_score,
            "trust_grade": self.trust_grade,
            "total_events": self.total_events,
            "allowed_ratio": self.allowed_ratio,
            "flagged_ratio": self.flagged_ratio,
            "blocked_ratio": self.blocked_ratio,
            "human_approvals": self.human_approvals,
            "human_rejections": self.human_rejections,
            "first_seen": self.first_seen,
            "last_active": self.last_active,
        }


def grade_for_score(score: int) -> TrustGrade:
    if score >= 90:
        return "verified"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    if score >= 15:
        return "low"
    return "unverified"


def compute_trust_score(
    total_events: int,
    allowed: int,
    flagged: int,
    blocked: int,
    human_approvals: int = 0,
    human_rejections: int = 0,
) -> int:
    """Score an agent 0-100 from its aggregate event stats.

    This is a pragmatic scoring model intended for early-stage agents;
    see the TypeScript SDK's ``trust/posture`` module for the full
    weighted variant.
    """
    if total_events <= 0:
        return 0

    allowed_ratio = allowed / total_events
    blocked_ratio = blocked / total_events

    base = 40  # every registered agent starts here
    base += int(allowed_ratio * 40)  # +0..40 for clean history
    base -= int(blocked_ratio * 30)  # -0..30 for breaches
    if total_events >= 100:
        base += 10
    if total_events >= 1000:
        base += 5
    base += min(15, human_approvals)
    base -= min(25, human_rejections * 5)

    return max(0, min(100, base))
