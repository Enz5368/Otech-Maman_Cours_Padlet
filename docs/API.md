# API REST `/api/v1`

Toutes les routes privées déduisent le propriétaire depuis le cookie de session. Aucun `user_id` fourni par le navigateur n'est accepté comme autorité.

## Authentification

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

Les opérations mutantes privées exigent également `X-CSRF-Token`, dont la valeur provient du cookie lisible `mep_csrf`. La session elle-même reste dans `mep_session`, inaccessible au JavaScript.

## Utilisateur

- `GET /users/me`
- `GET|PUT /users/me/settings`
- `GET /users/me/storage`

## Espace compatible

- `GET|PUT /workspace`
- `GET|POST /imports`

`PUT /workspace` utilise `expected_revision`. Une révision obsolète produit `409` et empêche l'écrasement silencieux d'une modification faite depuis un autre appareil.

## Entités pédagogiques

Chaque collection accepte `GET`, `POST`, `GET /:id`, `PATCH /:id` et `DELETE /:id` selon le cas :

- `/levels`
- `/sequences`
- `/lessons`
- `/activities`
- `/presentations`
- `/slides`
- `/slide-elements`
- `/resources`
- `/class-groups`
- `/students`
- `/absences`
- `/draw-history`
- `/timers`

Les relations parentes sont elles aussi contrôlées par propriétaire afin de bloquer les IDOR indirectes.

## Fichiers

- `GET|POST /files`
- `GET /files/:id/content`
- `DELETE /files/:id`
- `POST /files/:id/restore`

La route de contenu accepte `Range` et répond en `206 Partial Content`. Les chemins NAS ne sont jamais exposés.

## Recherche, exports et sauvegardes

- `GET /search?q=...`
- `GET|POST /exports`
- `GET /exports/:id/download`
- `GET|POST /backups`
- `POST /backups/:id/restore`

Les exports ZIP/PPTX historiques restent produits par le frontend. L'API ajoute l'export JSON serveur versionné.

## Administration

- `GET /admin/users`
- activation, désactivation, suppression logique, quota et réinitialisation forcée par utilisateur ;
- `GET /admin/audit-logs`
- `GET /admin/backups`
- `POST /admin/backups/:id/restore`

Ces routes exigent le rôle `admin`.

