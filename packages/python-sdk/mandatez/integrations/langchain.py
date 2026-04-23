"""LangChain callback handlers that route every tool call through MandateZ.

Install the extra first::

    pip install "mandatez[langchain]"

Usage::

    from langchain_openai import ChatOpenAI
    from mandatez import MandateZClient
    from mandatez.integrations.langchain import MandateZCallbackHandler

    client = MandateZClient(...)
    llm = ChatOpenAI(callbacks=[MandateZCallbackHandler(client)])

Events are emitted for:

* ``on_tool_start`` — tracked as ``call`` with resource ``tool:<name>``
* ``on_tool_end``   — tracked as ``call`` with ``outcome=allowed``
* ``on_tool_error`` — tracked as ``call`` with ``outcome=blocked``
* ``on_llm_start``  — tracked as ``call`` with resource ``llm:<model>``
* ``on_llm_error``  — tracked as ``call`` with ``outcome=blocked``
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

try:  # pragma: no cover - import guard
    from langchain.callbacks.base import (  # type: ignore
        AsyncCallbackHandler,
        BaseCallbackHandler,
    )
except ImportError:  # pragma: no cover - helpful error path
    try:
        from langchain_core.callbacks.base import (  # type: ignore
            AsyncCallbackHandler,
            BaseCallbackHandler,
        )
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "LangChain is not installed. Install it with "
            "`pip install \"mandatez[langchain]\"` or `pip install langchain`."
        ) from exc

from ..client import MandateZClient

__all__ = ["MandateZCallbackHandler", "AsyncMandateZCallbackHandler"]


def _tool_name(serialized: Optional[Dict[str, Any]]) -> str:
    if not serialized:
        return "unknown"
    return str(serialized.get("name") or serialized.get("id") or "unknown")


def _truncate(value: Any, limit: int = 500) -> str:
    text = str(value)
    return text if len(text) <= limit else text[:limit] + "…"


class MandateZCallbackHandler(BaseCallbackHandler):  # type: ignore[misc]
    """Sync LangChain callback handler that governs tool and LLM calls.

    Each callback emits a signed AgentEvent via :meth:`MandateZClient.track_sync`.
    Failures are caught and re-raised only if ``raise_on_error`` is ``True`` —
    otherwise the callback prefers to keep the LLM running over blocking on
    logging infrastructure.
    """

    def __init__(
        self,
        client: MandateZClient,
        *,
        raise_on_error: bool = False,
    ) -> None:
        super().__init__()
        self._client = client
        self._raise = raise_on_error

    # --------------------------------------------------------------- tools

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: Optional[UUID] = None,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        inputs: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        self._emit(
            action_type="call",
            resource=f"tool:{_tool_name(serialized)}",
            outcome="pending_approval",
            metadata={
                "phase": "start",
                "input": _truncate(input_str),
                "run_id": str(run_id) if run_id else None,
                "tags": tags or [],
                **(metadata or {}),
            },
        )

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: Optional[UUID] = None,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> None:
        self._emit(
            action_type="call",
            resource="tool:end",
            outcome="allowed",
            metadata={
                "phase": "end",
                "output": _truncate(output),
                "run_id": str(run_id) if run_id else None,
                "tags": tags or [],
            },
        )

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: Optional[UUID] = None,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> None:
        self._emit(
            action_type="call",
            resource="tool:error",
            outcome="blocked",
            metadata={
                "phase": "error",
                "error_type": type(error).__name__,
                "error": _truncate(error),
                "run_id": str(run_id) if run_id else None,
                "tags": tags or [],
            },
        )

    # ----------------------------------------------------------------- LLMs

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        model = (
            (serialized or {}).get("kwargs", {}).get("model_name")
            or (serialized or {}).get("name")
            or "unknown"
        )
        self._emit(
            action_type="call",
            resource=f"llm:{model}",
            outcome="pending_approval",
            metadata={
                "phase": "llm_start",
                "prompt_count": len(prompts),
                "run_id": str(run_id) if run_id else None,
            },
        )

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        self._emit(
            action_type="call",
            resource="llm:error",
            outcome="blocked",
            metadata={
                "phase": "llm_error",
                "error_type": type(error).__name__,
                "error": _truncate(error),
                "run_id": str(run_id) if run_id else None,
            },
        )

    # ------------------------------------------------------- internal plumbing

    def _emit(
        self,
        *,
        action_type: str,
        resource: str,
        outcome: str,
        metadata: Dict[str, Any],
    ) -> None:
        try:
            self._client.track_sync(
                action_type=action_type,
                resource=resource,
                outcome=outcome,
                metadata=metadata,
            )
        except Exception:  # noqa: BLE001 — integrity of LLM run > integrity of logging
            if self._raise:
                raise


class AsyncMandateZCallbackHandler(AsyncCallbackHandler):  # type: ignore[misc]
    """Async variant for LangChain chains that dispatch via ``AsyncCallbackHandler``."""

    def __init__(
        self,
        client: MandateZClient,
        *,
        raise_on_error: bool = False,
    ) -> None:
        super().__init__()
        self._client = client
        self._raise = raise_on_error

    async def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any,
    ) -> None:
        await self._emit(
            action_type="call",
            resource=f"tool:{_tool_name(serialized)}",
            outcome="pending_approval",
            metadata={"phase": "start", "input": _truncate(input_str)},
        )

    async def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        await self._emit(
            action_type="call",
            resource="tool:end",
            outcome="allowed",
            metadata={"phase": "end", "output": _truncate(output)},
        )

    async def on_tool_error(self, error: BaseException, **kwargs: Any) -> None:
        await self._emit(
            action_type="call",
            resource="tool:error",
            outcome="blocked",
            metadata={
                "phase": "error",
                "error_type": type(error).__name__,
                "error": _truncate(error),
            },
        )

    async def _emit(
        self,
        *,
        action_type: str,
        resource: str,
        outcome: str,
        metadata: Dict[str, Any],
    ) -> None:
        try:
            await self._client.track(
                action_type=action_type,
                resource=resource,
                outcome=outcome,
                metadata=metadata,
            )
        except Exception:  # noqa: BLE001
            if self._raise:
                raise
