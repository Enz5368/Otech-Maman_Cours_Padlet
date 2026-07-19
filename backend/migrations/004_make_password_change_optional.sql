-- Le changement de mot de passe se fait volontairement depuis Réglages.
-- Cette migration corrige aussi les comptes créés avant cette décision.
UPDATE users SET must_change_password = false WHERE must_change_password = true;
