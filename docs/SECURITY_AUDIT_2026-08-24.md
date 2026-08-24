# Audit de sécurité — 24 août 2026

## Périmètre

Audit statique du dépôt, des routes FastAPI, de l'authentification, du stockage, des images Docker,
des configurations Nginx/Compose et des fichiers copiés dans l'image frontend. Validation par lint,
tests automatisés, contrôle de secrets et construction des deux images. Aucun test intrusif n'a été
effectué contre la production.

========================================
AUDIT DE SÉCURITÉ
========================================

### [CRITIQUE]

- Aucun secret réel, mot de passe en clair, jeton, clé privée ou fichier `.env` suivi par Git ou copié
  dans l'image frontend n'a été trouvé.
- Les SVG uploadés pouvaient être servis inline sur l'origine authentifiée. Ils sont désormais forcés
  en téléchargement avec `application/octet-stream`, ce qui neutralise leur exécution dans l'origine.

### [IMPORTANT]

- Corrigé : absence de validation bloquante des paramètres dangereux en production (cookie non sécurisé,
  SQLite, CORS générique/non-HTTPS et URL publique non-HTTPS).
- Corrigé : réinitialisation de mot de passe absente du rate limiting Nginx et limitation applicative
  incomplète sur les flux de récupération.
- Corrigé : réponses API privées sans politique de cache globale explicite.
- À traiter par refactorisation : la CSP autorise encore `unsafe-inline` pour les scripts et styles, car
  l'interface actuelle utilise des gestionnaires HTML inline. Le retirer aujourd'hui casserait l'UI.
- À traiter : le limiteur applicatif est en mémoire par processus. Nginx fournit une seconde couche, mais
  Redis doit devenir la source commune avant un déploiement multi-réplicas.

### [MOYEN]

- Corrigé : cookies de session et CSRF passés de `SameSite=Lax` à `SameSite=Strict`.
- Corrigé : comparaison CSRF en temps constant.
- Corrigé : ajout de HSTS, COOP et CORP ; suppression de la version dans `/health`.
- À traiter : dépendances bornées mais sans lock avec hashes ; les builds ne sont pas parfaitement
  reproductibles.
- À traiter : le frontend est servi sous forme de sources lisibles, non minifiées et sans noms de fichiers
  hashés. Il n'expose pas de secret et aucune source map n'est publiée, mais un pipeline de build reste à créer.

### [FAIBLE]

- Les noms des routes et la logique publique restent visibles dans DevTools, ce qui est normal et ne doit
  jamais être considéré comme un secret.
- La CSP autorise des frames HTTPS pour les fonctions documentaires ; cette permission doit être réduite
  à une liste de fournisseurs lorsque leurs domaines définitifs sont connus.

## Protections confirmées

- Argon2id pour les mots de passe ; jetons de session et de récupération stockés uniquement sous forme de hash.
- Session serveur, cookie d'authentification `HttpOnly`, `Secure` en production, expiration, révocation et rotation.
- CSRF sur les opérations privées mutantes ; CORS explicite avec credentials.
- Autorisations serveur par utilisateur et rôle administrateur sur chaque route concernée ; UUID sans confiance implicite.
- Requêtes SQLAlchemy paramétrées, validation Pydantic, limites de pagination et isolation par `user_id`.
- Uploads renommés aléatoirement, limite de taille/quota, extension/MIME/signature contrôlés et chemins résolus sous la racine utilisateur.
- Erreurs publiques génériques, documentation API désactivée en production, `server_tokens off`.
- Aucun `.map`, `.env`, backup, clé privée, log ou fichier SQL dans l'image frontend.

## Validation

- `ruff` : réussi.
- Tests : 112 réussis.
- `python scripts/security_check.py` : 19 fichiers publics analysés, réussi.
- `docker compose config --quiet` : réussi.
- Images Docker frontend et backend : construites avec succès.

## Limites et actions manuelles

1. Tester les headers et les refus d'accès sur le domaine public après déploiement (les tests locaux ne
   prouvent pas la configuration Cloudflare/TLS externe).
2. Refactoriser les événements/styles inline avant de retirer `unsafe-inline` de la CSP.
3. Remplacer le limiteur mémoire par Redis pour les déploiements multi-workers/multi-réplicas.
4. Générer et maintenir un lock Python 3.12 avec hashes, puis exécuter un scanner CVE en CI.
5. Mettre en place un build frontend minifié avec fichiers hashés ; conserver les source maps hors du web.
6. Vérifier périodiquement les droits du dossier confidentiel local et confirmer qu'il reste hors Git et hors image.

## Notes après corrections

- Sécurité frontend : 7/10
- Sécurité backend : 8/10
- Authentification : 8/10
- Protection des données : 8/10
- Configuration serveur : 8/10
- **Note globale : 7,8/10**
