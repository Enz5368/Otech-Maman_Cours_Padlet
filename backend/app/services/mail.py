from __future__ import annotations

import smtplib
from email.message import EmailMessage

from ..config import Settings


def send_password_reset(settings: Settings, recipient: str, raw_token: str) -> bool:
    """Envoie un lien sans écrire le jeton dans les journaux."""
    if not settings.smtp_host or not settings.smtp_from:
        return False
    message = EmailMessage()
    message["Subject"] = "Réinitialisation du mot de passe MonEspaceProf"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    reset_url = f"{settings.public_base_url}/?reset-token={raw_token}"
    message.set_content(
        "Une réinitialisation du mot de passe MonEspaceProf a été demandée.\n\n"
        f"Lien valable une heure : {reset_url}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
            if settings.smtp_starttls:
                client.starttls()
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        return False
