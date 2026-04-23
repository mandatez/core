"""Runtime policy engine — same rule-match semantics as the TypeScript SDK.

Glob semantics::

    "emails"   matches  "emails"
    "api/*"    matches  "api/stripe", "api/slack"
    "api/**"   matches  "api/stripe", "api/stripe/charges"
    "*"        matches  everything
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional

__all__ = [
    "PolicyRule",
    "Policy",
    "PolicyEvaluation",
    "PolicyEngine",
    "match_resource",
]

ActionPattern = Literal["read", "write", "export", "delete", "call", "payment", "*"]
Effect = Literal["allow", "block", "flag"]
Outcome = Literal["allowed", "blocked", "flagged"]


@dataclass
class PolicyRule:
    id: str
    action_types: List[ActionPattern]
    resource_pattern: str
    effect: Effect


@dataclass
class Policy:
    id: str
    owner_id: str
    name: str
    rules: List[PolicyRule] = field(default_factory=list)


@dataclass
class PolicyEvaluation:
    outcome: Outcome
    matched_rule: Optional[PolicyRule]
    policy_id: Optional[str]


def match_resource(pattern: str, resource: str) -> bool:
    """Glob match a resource against a pattern (``*`` segment, ``**`` recursive)."""
    if pattern == "*":
        return True

    pattern_parts = pattern.split("/")
    resource_parts = resource.split("/")

    pi = ri = 0
    while pi < len(pattern_parts) and ri < len(resource_parts):
        if pattern_parts[pi] == "**":
            return True
        if pattern_parts[pi] == "*" or pattern_parts[pi] == resource_parts[ri]:
            pi += 1
            ri += 1
        else:
            return False

    return pi == len(pattern_parts) and ri == len(resource_parts)


def _effect_to_outcome(effect: Effect) -> Outcome:
    return {"allow": "allowed", "block": "blocked", "flag": "flagged"}[effect]


class PolicyEngine:
    """Evaluate actions against a list of policies. First matching rule wins."""

    def __init__(self, policies: Optional[List[Policy]] = None) -> None:
        self._policies: List[Policy] = list(policies or [])

    def add_policy(self, policy: Policy) -> None:
        self._policies.append(policy)

    def remove_policy(self, policy_id: str) -> None:
        self._policies = [p for p in self._policies if p.id != policy_id]

    @property
    def policies(self) -> List[Policy]:
        return list(self._policies)

    def evaluate(self, action_type: str, resource: str) -> PolicyEvaluation:
        for policy in self._policies:
            for rule in policy.rules:
                action_match = "*" in rule.action_types or action_type in rule.action_types
                resource_match = match_resource(rule.resource_pattern, resource)
                if action_match and resource_match:
                    return PolicyEvaluation(
                        outcome=_effect_to_outcome(rule.effect),
                        matched_rule=rule,
                        policy_id=policy.id,
                    )
        return PolicyEvaluation(outcome="allowed", matched_rule=None, policy_id=None)
