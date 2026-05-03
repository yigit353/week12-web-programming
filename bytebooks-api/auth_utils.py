"""
auth_utils.py - Password hashing and JWT helpers
=================================================

Two concerns live in this module:

  1. **Password hashing** — turn a user-supplied password into a one-way
     hash we can safely store in the database, and verify candidate
     passwords against a stored hash at login time.

  2. **JWT issuance & verification** — create a signed token that encodes
     "this request is from user X" and decode it back into the user id on
     subsequent requests.

Why bcrypt?
-----------
bcrypt is the default choice here because:

  * **Salt is built in** — every hash embeds a random 16-byte salt, so two
    users with the same password end up with different hashes. Rainbow
    tables stop working.
  * **Adaptive cost factor** — the number of rounds is tunable. Moore's
    law keeps making hardware faster, but we can turn the cost up to
    match, keeping brute-force attacks expensive forever.
  * **Constant-time verification** — timing attacks that try to distinguish
    "wrong password" from "no such user" by measuring response time don't
    work against bcrypt.

Fast hashes like MD5/SHA256 are the wrong tool: an attacker with a
commodity GPU can try billions of password guesses per second against
them. bcrypt is deliberately slow (tens of milliseconds per verify) so
that even a cracked database dump stays useless.

Why JWT?
--------
JWTs are **stateless bearer tokens**. The server doesn't need to remember
which tokens it has issued — every token carries, in its payload, enough
information (here: the user id) to answer "who is this?" and a signature
the server can verify on every request. That makes them a good fit for
APIs that may be scaled horizontally across many processes.

A JWT has three dot-separated parts: `header.payload.signature`. Only the
signature is secret-dependent — the header and payload are just
base64url-encoded JSON. That means a JWT is **not encrypted**: anyone can
read its contents. Never put secrets into the payload.
"""

from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY

# passlib's CryptContext wraps one or more hashing schemes. `bcrypt` is
# the only scheme we care about; `deprecated="auto"` tells passlib that
# if we ever add newer schemes, hashes produced by old ones should be
# considered deprecated (so we can rehash on next login).
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return the bcrypt hash of a plaintext password.

    This is a **one-way** transformation: there is no inverse. The output
    includes the bcrypt version marker, cost factor, and salt, so the
    database only needs one column (`hashed_password`) to store all of it.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if `plain_password` matches the stored bcrypt hash.

    Passlib extracts the salt and cost from the hash string, re-derives a
    candidate hash, and compares in constant time. Never implement this
    with `==` on raw hashes — constant-time comparison matters.
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """Encode the given dict as a signed JWT with a fixed expiration.

    `data` is the claim set, e.g. `{"sub": "42"}` where `sub` (subject)
    identifies the user. We mutate a copy, never the caller's dict, and
    add the `exp` claim — the JWT library rejects tokens whose `exp` is
    in the past at decode time.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Verify the signature and expiration of a JWT, return its payload.

    Raises:
        jose.JWTError: If the token is malformed, the signature does not
            match SECRET_KEY, or the `exp` claim is in the past.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
