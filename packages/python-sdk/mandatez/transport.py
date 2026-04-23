"""Supabase transport — thin async wrapper over the sync ``supabase`` client.

We deliberately keep this tiny. The full surface (insert event, upsert
agent, fetch agent, insert identity check, update trust) matches the
TypeScript SDK's ``SupabaseTransport`` shape so users can reason about
both SDKs with one mental model.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .events import AgentEvent
from .hibp import IdentityCheckResult
from .trust import TrustProfile

__all__ = ["SupabaseTransport"]


class SupabaseTransport:
    """Async façade over the sync supabase client."""

    def __init__(self, supabase_url: str, supabase_anon_key: str) -> None:
        if not supabase_url:
            raise ValueError("supabase_url is required")
        if not supabase_anon_key:
            raise ValueError("supabase_anon_key is required")
        self.supabase_url = supabase_url
        self.supabase_anon_key = supabase_anon_key
        self._client: Client = create_client(supabase_url, supabase_anon_key)

    @property
    def client(self) -> Client:
        return self._client

    # ---------- agents ----------

    async def upsert_agent(
        self,
        *,
        agent_id: str,
        owner_id: str,
        name: str,
        public_key: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        row = {
            "id": agent_id,
            "owner_id": owner_id,
            "name": name,
            "public_key": public_key,
            "metadata": metadata or {},
        }

        def _run() -> None:
            response = (
                self._client.table("agents").upsert(row, on_conflict="id").execute()
            )
            if getattr(response, "error", None):
                raise RuntimeError(
                    f"Failed to upsert agent: {response.error.message}"  # type: ignore[union-attr]
                )

        await asyncio.to_thread(_run)

    async def fetch_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        def _run() -> Optional[Dict[str, Any]]:
            response = (
                self._client.table("agents")
                .select("*")
                .eq("id", agent_id)
                .maybe_single()
                .execute()
            )
            return response.data if response and response.data else None

        return await asyncio.to_thread(_run)

    async def update_agent_trust(self, agent_id: str, profile: TrustProfile) -> None:
        payload = profile.to_dict()
        payload.pop("agent_id", None)

        def _run() -> None:
            response = (
                self._client.table("agents").update(payload).eq("id", agent_id).execute()
            )
            if getattr(response, "error", None):
                raise RuntimeError(
                    f"Failed to update agent trust: {response.error.message}"  # type: ignore[union-attr]
                )

        await asyncio.to_thread(_run)

    # ---------- events ----------

    async def emit_event(self, event: AgentEvent) -> AgentEvent:
        row = {
            "id": event.event_id,
            "agent_id": event.agent_id,
            "owner_id": event.owner_id,
            "timestamp": event.timestamp,
            "action_type": event.action_type,
            "resource": event.resource,
            "outcome": event.outcome,
            "policy_id": event.policy_id,
            "metadata": event.metadata or {},
            "signature": event.signature,
            "public_key": event.public_key,
        }

        def _run() -> None:
            response = self._client.table("agent_events").insert(row).execute()
            if getattr(response, "error", None):
                raise RuntimeError(
                    f"Failed to emit event: {response.error.message}"  # type: ignore[union-attr]
                )

        await asyncio.to_thread(_run)
        return event

    async def fetch_agent_events(self, agent_id: str) -> List[AgentEvent]:
        def _run() -> List[Dict[str, Any]]:
            response = (
                self._client.table("agent_events")
                .select("*")
                .eq("agent_id", agent_id)
                .order("timestamp", desc=False)
                .execute()
            )
            return list(response.data or [])

        rows = await asyncio.to_thread(_run)
        events: List[AgentEvent] = []
        for row in rows:
            events.append(
                AgentEvent.from_dict(
                    {
                        "event_id": row.get("id") or row.get("event_id"),
                        "agent_id": row["agent_id"],
                        "owner_id": row["owner_id"],
                        "timestamp": row["timestamp"],
                        "action_type": row["action_type"],
                        "resource": row["resource"],
                        "outcome": row["outcome"],
                        "policy_id": row.get("policy_id"),
                        "metadata": row.get("metadata") or {},
                        "signature": row["signature"],
                        "public_key": row["public_key"],
                    }
                )
            )
        return events

    # ---------- identity ----------

    async def insert_identity_check(
        self,
        *,
        owner_id: str,
        agent_id: str,
        email: str,
        result: IdentityCheckResult,
    ) -> None:
        row = {
            "owner_id": owner_id,
            "agent_id": agent_id,
            "email": email,
            "risk_score": result.risk_score,
            "breach_count": result.breach_count,
            "breaches": [
                {"name": b.name, "date": b.date, "sensitive": b.sensitive}
                for b in result.breaches
            ],
            "status": result.status,
        }

        def _run() -> None:
            response = self._client.table("identity_checks").insert(row).execute()
            if getattr(response, "error", None):
                raise RuntimeError(
                    f"Failed to insert identity check: {response.error.message}"  # type: ignore[union-attr]
                )

        await asyncio.to_thread(_run)
