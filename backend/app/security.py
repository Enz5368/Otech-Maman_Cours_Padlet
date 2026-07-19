from __future__ import annotations

import hashlib
import secrets
import unicodedata
from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

password_hasher = PasswordHasher(time_cost=3, memory_cost=65_536, parallelism=2, hash_len=32, salt_len=16)


def normalize_username(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).strip().casefold()
    return "".join(char for char in normalized if char.isalnum() or char in {"-", "_", "."})[:80]


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return password_hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def digest_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SessionSecrets:
    session_token: str
    session_hash: str
    csrf_token: str
    csrf_hash: str


def new_session_secrets() -> SessionSecrets:
    session_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    return SessionSecrets(session_token, digest_token(session_token), csrf_token, digest_token(csrf_token))
