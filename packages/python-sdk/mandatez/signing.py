"""Ed25519 signing and verification — cross-compatible with @mandatez/sdk (TypeScript).

The canonical payload string is produced by sorting the top-level keys
alphabetically and JSON-encoding with compact separators and raw UTF-8.
This matches the TypeScript implementation::

    JSON.stringify(event, Object.keys(event).sort())

Key formats accepted (we reduce everything down to a 32-byte Ed25519 seed):

* ``hex(32)``  — 64 hex chars, raw seed. This is what
  :func:`generate_agent_identity` emits by default.
* ``hex(64)`` — 128 hex chars, libsodium secret key (seed + public).
* ``base64(44)`` — standard base64 of a 32-byte seed.
* ``base64(88)`` — standard base64 of a 64-byte libsodium secret key,
  which is what the TypeScript SDK emits.
"""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any, Dict

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

__all__ = [
    "canonicalize",
    "load_seed",
    "sign_event",
    "verify_event",
    "derive_public_key",
]


def canonicalize(event: Dict[str, Any]) -> str:
    """Return the canonical string form of an event for signing.

    Top-level keys are sorted alphabetically. Nested dicts preserve
    insertion order (matching ``JSON.stringify(obj, Object.keys(obj).sort())``
    behaviour on the TypeScript side).
    """
    ordered = {k: event[k] for k in sorted(event.keys())}
    return json.dumps(ordered, separators=(",", ":"), ensure_ascii=False)


def _try_b64(raw: str) -> bytes | None:
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        return None


def _try_hex(raw: str) -> bytes | None:
    try:
        return bytes.fromhex(raw)
    except ValueError:
        return None


def load_seed(private_key: str) -> bytes:
    """Reduce any supported private-key encoding to a 32-byte Ed25519 seed."""
    stripped = private_key.strip()
    if not stripped:
        raise ValueError("private_key is empty")

    # Prefer hex when the input is all hex digits (avoids the rare
    # collision where a hex string also happens to be valid base64).
    candidate: bytes | None = None
    if all(c in "0123456789abcdefABCDEF" for c in stripped):
        candidate = _try_hex(stripped)
    if candidate is None:
        candidate = _try_b64(stripped) or _try_hex(stripped)

    if candidate is None:
        raise ValueError("private_key is not valid hex or base64")

    if len(candidate) == 32:
        return candidate
    if len(candidate) == 64:
        # libsodium secret key layout: seed (32) || public_key (32)
        return candidate[:32]

    raise ValueError(
        f"private_key must decode to 32 or 64 bytes (got {len(candidate)})"
    )


def derive_public_key(private_key: str) -> str:
    """Return the base64-encoded Ed25519 public key for a private key."""
    seed = load_seed(private_key)
    signing_key = SigningKey(seed)
    return base64.b64encode(bytes(signing_key.verify_key)).decode("ascii")


def sign_event(
    unsigned_event: Dict[str, Any],
    private_key: str,
) -> Dict[str, Any]:
    """Return ``unsigned_event`` with ``signature`` and ``public_key`` fields added.

    The caller is responsible for ensuring every required AgentEvent field
    except ``signature`` and ``public_key`` is already present.
    """
    seed = load_seed(private_key)
    signing_key = SigningKey(seed)
    public_key_b64 = base64.b64encode(bytes(signing_key.verify_key)).decode("ascii")

    event_with_public_key = {**unsigned_event, "public_key": public_key_b64}
    payload = canonicalize(event_with_public_key).encode("utf-8")

    signed = signing_key.sign(payload)
    signature_b64 = base64.b64encode(signed.signature).decode("ascii")

    return {**event_with_public_key, "signature": signature_b64}


def verify_event(event: Dict[str, Any]) -> bool:
    """Return ``True`` iff the event's signature matches its ``public_key``."""
    try:
        signature_b64 = event["signature"]
        public_key_b64 = event["public_key"]
    except KeyError:
        return False

    unsigned = {k: v for k, v in event.items() if k != "signature"}
    payload = canonicalize(unsigned).encode("utf-8")

    try:
        signature = base64.b64decode(signature_b64, validate=True)
        public_key = base64.b64decode(public_key_b64, validate=True)
        VerifyKey(public_key).verify(payload, signature)
        return True
    except (BadSignatureError, binascii.Error, ValueError, TypeError):
        return False
