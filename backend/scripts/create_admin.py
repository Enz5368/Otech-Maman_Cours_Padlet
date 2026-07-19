from __future__ import annotations

import getpass

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.security import normalize_username
from app.services.accounts import create_user


def main() -> None:
    username = input("Identifiant administrateur : ").strip()
    password = getpass.getpass("Mot de passe administrateur : ")
    if len(password) < 10:
        raise SystemExit("Le mot de passe doit contenir au moins 10 caractères")
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.username_normalized == normalize_username(username))):
            raise SystemExit("Cet identifiant existe déjà")
        create_user(db, get_settings(), username=username, password=password, role="admin")
        db.commit()
    print("Administrateur créé.")


if __name__ == "__main__":
    main()
