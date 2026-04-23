"""HaveIBeenPwned v3 client + risk scoring — port of the TS ``identity/hibp`` module.

Scoring table::

    0 breaches                  -> score 0, status 'clean'
    1 breach, all >1yr old      -> score 1, status 'clean'
    1-2 recent breaches         -> score 2, status 'flagged'
    3+ breaches OR any sensitive -> score 3, status 'blocked'
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Literal, Optional
from urllib.parse import quote

import httpx

__all__ = [
    "HibpBreach",
    "IdentityStatus",
    "IdentityCheckResult",
    "check_identity",
    "score_breaches",
]

HIBP_API_BASE = "https://haveibeenpwned.com/api/v3"
ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

IdentityStatus = Literal["clean", "flagged", "blocked"]


@dataclass
class HibpBreach:
    name: str
    date: str  # YYYY-MM-DD
    sensitive: bool


@dataclass
class IdentityCheckResult:
    status: IdentityStatus
    risk_score: int  # 0-3
    breach_count: int
    breaches: List[HibpBreach] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "risk_score": self.risk_score,
            "breach_count": self.breach_count,
            "breaches": [
                {"name": b.name, "date": b.date, "sensitive": b.sensitive}
                for b in self.breaches
            ],
        }


def _is_recent(breach_date: str, now: Optional[datetime] = None) -> bool:
    reference = now or datetime.now(tz=timezone.utc)
    try:
        parsed = datetime.fromisoformat(breach_date)
    except ValueError:
        return True  # if we can't parse, assume recent (conservative)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    age = (reference - parsed).total_seconds()
    return age < ONE_YEAR_SECONDS


def score_breaches(
    breaches: List[HibpBreach],
    now: Optional[datetime] = None,
) -> IdentityCheckResult:
    """Convert a list of breaches into the canonical risk result."""
    count = len(breaches)

    if count == 0:
        return IdentityCheckResult(status="clean", risk_score=0, breach_count=0, breaches=[])

    if any(b.sensitive for b in breaches) or count >= 3:
        return IdentityCheckResult(
            status="blocked", risk_score=3, breach_count=count, breaches=breaches
        )

    all_old = all(not _is_recent(b.date, now) for b in breaches)
    if count == 1 and all_old:
        return IdentityCheckResult(
            status="clean", risk_score=1, breach_count=1, breaches=breaches
        )

    return IdentityCheckResult(
        status="flagged", risk_score=2, breach_count=count, breaches=breaches
    )


async def check_identity(
    email: str,
    api_key: str,
    *,
    http: Optional[httpx.AsyncClient] = None,
) -> IdentityCheckResult:
    """Call HIBP for ``email`` and return a normalized risk result."""
    if not email or "@" not in email:
        raise ValueError("check_identity: invalid email")
    if not api_key:
        raise ValueError("check_identity: HIBP API key is required")

    url = f"{HIBP_API_BASE}/breachedaccount/{quote(email, safe='')}?truncateResponse=false"
    headers = {
        "hibp-api-key": api_key,
        "user-agent": "MandateZ-IdentityIntelligence-Python",
        "accept": "application/json",
    }

    owns_client = http is None
    client = http or httpx.AsyncClient(timeout=10.0)
    try:
        response = await client.get(url, headers=headers)
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code == 404:
        return IdentityCheckResult(status="clean", risk_score=0, breach_count=0, breaches=[])

    if response.status_code in (401, 403):
        raise RuntimeError(
            "HIBP API key is invalid or missing required entitlements"
        )

    if response.status_code == 429:
        raise RuntimeError("HIBP rate limit exceeded — retry after the cooldown window")

    if response.status_code >= 400:
        raise RuntimeError(
            f"HIBP request failed: {response.status_code} {response.text[:200]}"
        )

    raw = response.json()
    breaches: List[HibpBreach] = []
    for item in raw:
        breaches.append(
            HibpBreach(
                name=item.get("Name") or item.get("Title") or "",
                date=item.get("BreachDate") or "",
                sensitive=bool(item.get("IsSensitive")),
            )
        )
    return score_breaches(breaches)
