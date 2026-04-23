"""MandateZClient — the main async entry point for the Python SDK.

Usage::

    import os
    from mandatez import MandateZClient, generate_agent_identity

    identity = generate_agent_identity()
    client = MandateZClient(
        agent_id=identity.agent_id,
        owner_id="your_org_id",
        private_key=identity.private_key,
        supabase_url=os.environ["SUPABASE_URL"],
        supabase_anon_key=os.environ["SUPABASE_ANON_KEY"],
    )

    event = await client.track(action_type="read", resource="emails")
    print(event.event_id, event.outcome)
"""

from __future__ import annotations

import asyncio
import os
import threading
from typing import Any, Awaitable, Dict, List, Literal, Optional, TypeVar

from .events import ACTION_TYPES, AgentEvent, create_signed_event
from .hibp import IdentityCheckResult, check_identity
from .policy import Policy, PolicyEngine, PolicyEvaluation
from .signing import derive_public_key
from .transport import SupabaseTransport
from .trust import TrustProfile, compute_trust_score, grade_for_score

__all__ = ["MandateZClient"]

FlaggedAction = Literal["restrict", "allow", "block"]
T = TypeVar("T")


class MandateZClient:
    """High-level governance client for a single agent.

    Every public ``async`` method produces a signed AgentEvent in the
    same canonical form as ``@mandatez/sdk`` on npm, so events written
    from Python verify correctly from TypeScript and vice versa.
    """

    def __init__(
        self,
        *,
        agent_id: str,
        owner_id: str,
        private_key: str,
        supabase_url: str,
        supabase_anon_key: str,
        policies: Optional[List[Policy]] = None,
        hibp_api_key: Optional[str] = None,
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not agent_id.startswith("ag_"):
            raise ValueError(f"agent_id must start with 'ag_' prefix, got {agent_id!r}")
        if not owner_id:
            raise ValueError("owner_id is required")

        self.agent_id = agent_id
        self.owner_id = owner_id
        self.private_key = private_key
        self.name = name or agent_id
        self.metadata = metadata or {}
        self.hibp_api_key = hibp_api_key or os.environ.get("HIBP_API_KEY")

        self._public_key = derive_public_key(private_key)
        self._policy_engine = PolicyEngine(policies)
        self._transport = SupabaseTransport(supabase_url, supabase_anon_key)
        self._agent_registered = False

        # Background event loop for sync callers (e.g. LangChain callbacks).
        self._bg_loop: Optional[asyncio.AbstractEventLoop] = None
        self._bg_thread: Optional[threading.Thread] = None
        self._bg_lock = threading.Lock()

    # ------------------------------------------------------------------ track

    async def track(
        self,
        *,
        action_type: str,
        resource: str,
        metadata: Optional[Dict[str, Any]] = None,
        outcome: Optional[str] = None,
        policy_id: Optional[str] = None,
    ) -> AgentEvent:
        """Sign and emit a single AgentEvent, evaluating policy first.

        When ``outcome`` is supplied, it overrides the policy engine's
        verdict — use this when your wrapper already knows the result
        (for example, an external call that returned an error). When
        omitted, the policy engine decides.
        """
        if action_type not in ACTION_TYPES:
            raise ValueError(
                f"action_type must be one of {ACTION_TYPES}, got {action_type!r}"
            )

        decision: PolicyEvaluation = self._policy_engine.evaluate(action_type, resource)
        final_outcome = outcome or decision.outcome
        final_policy_id = policy_id if policy_id is not None else decision.policy_id

        await self._ensure_registered()

        event = create_signed_event(
            agent_id=self.agent_id,
            owner_id=self.owner_id,
            action_type=action_type,  # type: ignore[arg-type]
            resource=resource,
            outcome=final_outcome,  # type: ignore[arg-type]
            policy_id=final_policy_id,
            metadata=metadata,
            private_key=self.private_key,
        )

        await self._transport.emit_event(event)
        return event

    # ----------------------------------------------------------- check_policy

    async def check_policy(
        self,
        *,
        action_type: str,
        resource: str,
    ) -> PolicyEvaluation:
        """Return the policy decision for a hypothetical action without emitting."""
        if action_type not in ACTION_TYPES:
            raise ValueError(
                f"action_type must be one of {ACTION_TYPES}, got {action_type!r}"
            )
        return self._policy_engine.evaluate(action_type, resource)

    def add_policy(self, policy: Policy) -> None:
        self._policy_engine.add_policy(policy)

    def remove_policy(self, policy_id: str) -> None:
        self._policy_engine.remove_policy(policy_id)

    # ------------------------------------------------------- get_trust_profile

    async def get_trust_profile(self) -> TrustProfile:
        """Return the current trust profile for this agent."""
        events = await self._transport.fetch_agent_events(self.agent_id)
        total = len(events)
        allowed = sum(1 for e in events if e.outcome == "allowed")
        flagged = sum(1 for e in events if e.outcome == "flagged")
        blocked = sum(1 for e in events if e.outcome == "blocked")

        score = compute_trust_score(total, allowed, flagged, blocked)
        grade = grade_for_score(score)

        allowed_ratio = allowed / total if total else 0.0
        flagged_ratio = flagged / total if total else 0.0
        blocked_ratio = blocked / total if total else 0.0

        first_seen = events[0].timestamp if events else None
        last_active = events[-1].timestamp if events else None

        return TrustProfile(
            agent_id=self.agent_id,
            trust_score=score,
            trust_grade=grade,
            total_events=total,
            allowed_ratio=allowed_ratio,
            flagged_ratio=flagged_ratio,
            blocked_ratio=blocked_ratio,
            first_seen=first_seen,
            last_active=last_active,
        )

    # ---------------------------------------------------------- check_identity

    async def check_identity(
        self,
        *,
        email: str,
        on_flagged: FlaggedAction = "restrict",
    ) -> IdentityCheckResult:
        """Screen an email against HaveIBeenPwned and log the result.

        The returned result's ``status`` is ``clean``, ``flagged``, or
        ``blocked``. On ``flagged``, ``on_flagged`` determines whether
        the calling wrapper should allow, restrict, or block — it does
        not change what is recorded, only what the caller should do.
        """
        if not self.hibp_api_key:
            raise RuntimeError(
                "check_identity requires an HIBP API key — pass hibp_api_key "
                "to MandateZClient() or set the HIBP_API_KEY env var"
            )

        result = await check_identity(email, self.hibp_api_key)

        await self._transport.insert_identity_check(
            owner_id=self.owner_id,
            agent_id=self.agent_id,
            email=email,
            result=result,
        )

        # Mirror the screening itself as a signed event so the action
        # is visible in the audit trail.
        screening_outcome = (
            "blocked"
            if result.status == "blocked"
            else "flagged"
            if result.status == "flagged"
            else "allowed"
        )
        await self.track(
            action_type="read",
            resource=f"identity:hibp:{email}",
            outcome=screening_outcome,
            metadata={
                "hibp_status": result.status,
                "hibp_risk_score": result.risk_score,
                "hibp_breach_count": result.breach_count,
                "on_flagged": on_flagged,
            },
        )

        return result

    # ------------------------------------------------------------ bookkeeping

    async def _ensure_registered(self) -> None:
        """Idempotently upsert the agent row the first time we emit an event."""
        if self._agent_registered:
            return
        await self._transport.upsert_agent(
            agent_id=self.agent_id,
            owner_id=self.owner_id,
            name=self.name,
            public_key=self._public_key,
            metadata=self.metadata,
        )
        self._agent_registered = True

    @property
    def public_key(self) -> str:
        return self._public_key

    # ----------------------------------------------------- sync-from-async shims

    def _ensure_bg_loop(self) -> asyncio.AbstractEventLoop:
        """Lazy-start a daemon thread running its own event loop."""
        with self._bg_lock:
            if self._bg_loop is None or not self._bg_loop.is_running():
                self._bg_loop = asyncio.new_event_loop()
                ready = threading.Event()

                def _run(loop: asyncio.AbstractEventLoop) -> None:
                    asyncio.set_event_loop(loop)
                    ready.set()
                    loop.run_forever()

                self._bg_thread = threading.Thread(
                    target=_run, args=(self._bg_loop,), daemon=True, name="mandatez-bg"
                )
                self._bg_thread.start()
                ready.wait()
            return self._bg_loop

    def _run_sync(self, coro: Awaitable[T]) -> T:
        """Run ``coro`` to completion from a sync call site.

        If we're inside a running event loop (e.g. inside an async
        framework's sync callback), dispatch to our background loop
        via ``run_coroutine_threadsafe``. Otherwise, run directly.
        """
        try:
            asyncio.get_running_loop()
            has_loop = True
        except RuntimeError:
            has_loop = False

        if has_loop:
            future = asyncio.run_coroutine_threadsafe(coro, self._ensure_bg_loop())  # type: ignore[arg-type]
            return future.result()
        return asyncio.run(coro)  # type: ignore[arg-type]

    def track_sync(
        self,
        *,
        action_type: str,
        resource: str,
        metadata: Optional[Dict[str, Any]] = None,
        outcome: Optional[str] = None,
        policy_id: Optional[str] = None,
    ) -> AgentEvent:
        """Synchronous form of :meth:`track`. Safe to call from framework callbacks."""
        return self._run_sync(
            self.track(
                action_type=action_type,
                resource=resource,
                metadata=metadata,
                outcome=outcome,
                policy_id=policy_id,
            )
        )

    def check_policy_sync(
        self, *, action_type: str, resource: str
    ) -> PolicyEvaluation:
        """Synchronous form of :meth:`check_policy`."""
        return self._policy_engine.evaluate(action_type, resource)
