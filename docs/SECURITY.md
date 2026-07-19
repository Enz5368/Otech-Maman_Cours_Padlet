# Sécurité

## Protections implémentées

- Hash des mots de passe avec Argon2id et sel aléatoire.
- Session opaque aléatoire ; seul son SHA-256 est stocké en base.
- Cookie session HTTP-only, Secure en production, SameSite=Lax.
- Jeton CSRF lié à chaque session.
- Rotation, expiration, déconnexion et révocation des sessions.
- Limitation des connexions dans l'API et dans Nginx.
- Verrouillage temporaire après échecs répétés.
- Requêtes SQL paramétrées par SQLAlchemy.
- Isolation `user_id` et contrôle des parents sur chaque ressource.
- Chemins résolus sous une racine UUID et rejet du path traversal.
- Extensions/MIME autorisés, noms internes aléatoires, tailles et quotas.
- Suppression logique des fichiers et corbeille.
- En-têtes CSP, anti-sniffing, anti-framing, Referrer-Policy et Permissions-Policy.
- Journaux d'audit sans mots de passe ni jetons bruts.

## Secrets

Les secrets vivent exclusivement dans `.env` sur le NAS et dans les secrets GitHub existants. `.env` est ignoré par Git. Le fichier doit appartenir à l'administrateur et être lisible uniquement par le compte de déploiement.

## Limites connues et extensions prévues

- Le frontend historique contient des attributs `onclick` et des styles en ligne. La CSP autorise donc encore `unsafe-inline` pour préserver strictement l'interface. Leur suppression pourra se faire après constitution de captures sur tous les écrans.
- La validation MIME combine déclaration, extension et famille MIME. Un service ClamAV n'est pas activé par défaut ; il peut être placé devant la finalisation des uploads.
- Redis est déployé pour le futur rate limiting distribué et les tâches asynchrones ; la première version utilise aussi une limite mémoire locale et Nginx.
- L'envoi de récupération nécessite la configuration SMTP du NAS.
- Les snapshots ZFS restent à configurer dans l'interface TrueNAS, en complément des sauvegardes applicatives.

