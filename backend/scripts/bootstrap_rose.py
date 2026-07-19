from __future__ import annotations

import getpass

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.security import normalize_username
from app.services.accounts import create_user


def main() -> None:
    settings = get_settings()
    password = getpass.getpass("Mot de passe initial de rose : ")
    if not password:
        raise SystemExit("Mot de passe obligatoire")
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.username_normalized == normalize_username("rose"))):
            raise SystemExit("Le compte rose existe déjà")
        create_user(db, settings, username="rose", password=password, must_change_password=False)
        db.commit()
    print("Compte rose créé avec Argon2id ; changement obligatoire à la première connexion.")


if __name__ == "__main__":
    main()
