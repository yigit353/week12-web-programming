"""
config.py - Application-wide configuration constants
=====================================================

All security-critical parameters live here so they can be swapped in one
place. Every value in this file affects how authentication works — if any
of them changes, previously-issued tokens may stop being valid.

The values below are hardcoded for **educational convenience only**.
In any real deployment you MUST:

  1. Load SECRET_KEY from an environment variable (e.g. via `os.getenv`
     or Pydantic's `BaseSettings`). A hardcoded secret committed to git
     is no secret at all — anyone with read access to the repo can
     forge valid tokens.
  2. Generate the secret with a cryptographically-strong generator, e.g.
         python -c "import secrets; print(secrets.token_hex(32))"
  3. Rotate the key periodically. Issued tokens become invalid when the
     key changes, so plan a deployment window for user re-login.
  4. Never log the secret, never return it in an error message.
"""

import os

# Signs every JWT we issue. Treat it like a password for the whole system:
# leaking it lets an attacker mint tokens that impersonate any user.
# In production (Railway) SECRET_KEY is set as an environment variable; the
# fallback below is for local development only and must never be relied on
# in a deployed environment.
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
)

# HMAC-SHA256 is a symmetric signing algorithm: the same SECRET_KEY both
# signs and verifies. Asymmetric alternatives (RS256/ES256) are better
# when the verifier should not have the power to mint tokens — e.g. a
# separate auth service signs, and each microservice verifies with a
# public key. For a single-process app, HS256 is the right default.
ALGORITHM = "HS256"

# How long a freshly-issued access token stays valid, in minutes.
# Shorter windows reduce the blast radius of a stolen token but force
# users to re-authenticate more often. Production systems usually pair
# a short access token (15 min) with a longer-lived refresh token.
ACCESS_TOKEN_EXPIRE_MINUTES = 60
