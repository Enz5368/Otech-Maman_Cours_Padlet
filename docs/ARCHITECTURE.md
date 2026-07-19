# Architecture cible

```text
Navigateur
   │ HTTPS public (Cloudflare)
   ▼
Cloudflare Tunnel / Access
   │ HTTP local :30080
   ▼
Nginx frontal
   ├── /api/v1/* ──► FastAPI ──► PostgreSQL
   │                    │          Redis (limitation/cache futur)
   │                    └────────► /mnt/DriveMaison/Users/<uuid>
   └── /* ─────────► frontend statique inchangé
```

## Principes

- PostgreSQL est l'autorité pour les comptes, sessions et contenus.
- L'utilisateur provient exclusivement de la session HTTP-only validée côté serveur.
- Chaque lecture/écriture privée contient un filtre `user_id = authenticated_user.id`.
- Les chemins utilisateurs sont fondés sur l'UUID interne et validés après résolution.
- Le cache local ne sert qu'au brouillon, à la reprise hors-ligne et à la migration.
- Les volumes de données ne sont jamais inclus dans une image ni supprimés au déploiement.
- Cloudflare reste le seul terminateur HTTPS public ; le réseau local reste en HTTP.

## Services Docker

- `nginx` : entrée locale sur le port 30080, proxy API et en-têtes de sécurité.
- `frontend` : sert les fichiers statiques immuables.
- `backend` : API FastAPI, migrations et tâches métier.
- `postgres` : données relationnelles persistantes.
- `redis` : préparé pour rate limiting, cache et tâches futures.

## Compatibilité du modèle historique

Le frontend manipule encore un document pédagogique complet. L'API conserve une version transactionnelle de ce document pour éviter toute régression, puis synchronise ses objets vers les tables normalisées. Cette couche anticorruption permet une migration progressive sans changer le studio ni les écrans.

