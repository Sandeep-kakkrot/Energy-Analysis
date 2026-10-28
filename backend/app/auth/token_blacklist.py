"""
In-memory refresh-token blacklist.

After a user logs out, their refresh token is added here so it
cannot be reused to issue new access tokens.

For production use, swap this for a Redis SET with TTL equal to
the refresh-token lifetime.
"""
from __future__ import annotations

_blacklist: set[str] = set()


def add(token: str) -> None:
    """Blacklist a refresh token on logout."""
    _blacklist.add(token)


def is_blacklisted(token: str) -> bool:
    """Return True if the token has been invalidated."""
    return token in _blacklist
