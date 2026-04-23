"""CrewAI integration — governed_agent factory + task-level callbacks.

Install the extra first::

    pip install "mandatez[crewai]"

Usage::

    from mandatez import MandateZClient
    from mandatez.integrations.crewai import governed_agent

    client = MandateZClient(...)

    analyst = governed_agent(
        mandatez_client=client,
        role="Market Analyst",
        goal="Research market trends",
        backstory="A seasoned analyst with 10 years of experience.",
    )

Every step this agent takes produces a signed AgentEvent with
``resource=crewai:agent:<role>`` and ``action_type=call``. Errors
inside a step are tracked as ``outcome=blocked``.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

try:  # pragma: no cover - import guard
    from crewai import Agent  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "CrewAI is not installed. Install it with "
        "`pip install \"mandatez[crewai]\"` or `pip install crewai`."
    ) from exc

from ..client import MandateZClient

__all__ = ["governed_agent", "make_step_callback"]


def _stringify(value: Any, limit: int = 500) -> str:
    text = str(value)
    return text if len(text) <= limit else text[:limit] + "…"


def make_step_callback(
    client: MandateZClient,
    *,
    role: str,
    existing: Optional[Callable[[Any], Any]] = None,
) -> Callable[[Any], Any]:
    """Return a CrewAI ``step_callback`` that emits signed events."""

    resource = f"crewai:agent:{role}"

    def _callback(step_output: Any) -> Any:
        try:
            client.track_sync(
                action_type="call",
                resource=resource,
                outcome="allowed",
                metadata={
                    "framework": "crewai",
                    "role": role,
                    "step": _stringify(step_output),
                },
            )
        except Exception:  # noqa: BLE001 — never block the crew for logging
            pass

        if existing is not None:
            return existing(step_output)
        return None

    return _callback


def governed_agent(
    *,
    mandatez_client: MandateZClient,
    role: str,
    goal: str,
    backstory: Optional[str] = None,
    **kwargs: Any,
) -> "Agent":
    """Return a CrewAI :class:`Agent` whose every step is signed and logged.

    Any ``step_callback`` already present in ``kwargs`` is preserved —
    MandateZ wraps it rather than replacing it.
    """
    existing_cb = kwargs.pop("step_callback", None)
    kwargs["step_callback"] = make_step_callback(
        mandatez_client, role=role, existing=existing_cb
    )

    agent_kwargs = {"role": role, "goal": goal, **kwargs}
    if backstory is not None:
        agent_kwargs["backstory"] = backstory

    # Upfront register-and-log so the agents row exists before the crew runs.
    try:
        mandatez_client.track_sync(
            action_type="call",
            resource=f"crewai:agent:{role}",
            outcome="allowed",
            metadata={
                "framework": "crewai",
                "phase": "register",
                "role": role,
                "goal": _stringify(goal),
            },
        )
    except Exception:  # noqa: BLE001
        pass

    return Agent(**agent_kwargs)
