# Exploitation TrueNAS

## 1. Préparer les datasets

Créer et conserver hors du dépôt :

```text
/mnt/DriveMaison/Database/postgres
/mnt/DriveMaison/Database/redis
/mnt/DriveMaison/Users
/mnt/DriveMaison/Backups
/mnt/DriveMaison/Logs
```

Le conteneur backend utilise l'UID/GID `10001`. Les répertoires Users, Backups et Logs doivent lui être accessibles. PostgreSQL doit pouvoir écrire dans son dataset. Ne jamais monter un de ces dossiers dans l'image frontend.

## 2. Configurer l'environnement

Dans `/mnt/DriveMaison/Database/deploy/apps/Otech-Maman_Cours_Padlet` :

```sh
cp .env.example .env
chmod 600 .env
```

Remplacer le mot de passe PostgreSQL et configurer éventuellement SMTP. Ne pas ajouter `.env` à Git.

## 3. Premier démarrage

Avant le premier basculement uniquement, arrêter l'ancien conteneur Nginx qui occupe le port `30080`, sans supprimer `/mnt/DriveMaison/Sites/monespaceprof`. Ce répertoire reste une copie de retour arrière de la version statique.

```sh
docker compose config --quiet
docker compose build
docker compose up -d
curl -fsS http://127.0.0.1:30080/health
```

Les migrations SQL sont appliquées automatiquement et une seule fois par nom de fichier.

Cloudflare Tunnel doit continuer à cibler :

```text
http://192.168.1.30:30080
```

Ne jamais utiliser HTTPS sur cette origine locale.

## 4. Migrer le compte `rose`

Créer le compte sans écrire le mot de passe initial dans Git ou dans une commande shell :

```sh
docker compose exec backend python scripts/bootstrap_rose.py
```

Saisir `it` dans l'invite masquée. Le serveur enregistre uniquement son hash Argon2id et marque le compte comme devant changer de mot de passe. À la première connexion, une modale utilisant le style historique impose ce changement.

Après le changement, l'assistant détecte `italia-html-data-v2-rose`, crée une copie locale, transfère les données et fichiers, compare les compteurs, puis demande séparément l'autorisation de supprimer l'ancienne clé.

## 5. Créer un professeur

Le comportement historique est conservé : un identifiant inconnu saisi sur l'écran de connexion crée un compte serveur. Le mot de passe doit contenir au moins dix caractères. Le serveur vérifie l'unicité, crée l'UUID, les réglages, le quota, le workspace et toute l'arborescence de fichiers.

Une création explicite peut aussi appeler `POST /api/v1/auth/register`.

## 6. Créer un administrateur

La migration `002_bootstrap_root.sql` crée automatiquement l'administrateur d'amorçage `root`. Son mot de passe initial demandé est hashé avec Argon2id et doit obligatoirement être remplacé dès la première connexion.

```sh
docker compose exec backend python scripts/create_admin.py
```

Le mot de passe est saisi dans une invite masquée. L'administrateur ne peut jamais lire les hashes ou mots de passe existants via l'API.

## 7. Sauvegardes

- `scheduler` crée les sauvegardes utilisateur quotidiennes, hebdomadaires le dimanche et mensuelles le premier jour du mois.
- `postgres-backup` crée chaque jour un `pg_dump` avec SHA-256 sous `/mnt/DriveMaison/Backups/postgres`.
- `scripts/backup.sh` produit à la demande un instantané global PostgreSQL + fichiers utilisateurs.
- Configurer en complément des snapshots ZFS TrueNAS sur Database, Users et Backups.

Sauvegarde manuelle avant maintenance :

```sh
sh scripts/backup.sh
```

## 8. Restaurer un compte

Un professeur peut restaurer une de ses sauvegardes avec `POST /api/v1/backups/:id/restore`. Un administrateur peut restaurer la sauvegarde d'un compte depuis `POST /api/v1/admin/backups/:id/restore`. Chaque restauration crée une nouvelle révision et un journal d'audit.

Pour un compte désactivé, le réactiver d'abord avec `/api/v1/admin/users/:id/enable`. Une suppression d'utilisateur via l'API est logique et reste récupérable.

## 9. Restauration globale

Vérifier le chemin exact, les checksums et disposer d'une sauvegarde supplémentaire avant l'opération :

```sh
sh scripts/restore.sh /mnt/DriveMaison/Backups/global/<horodatage> --confirm
```

Cette opération remplace la base et les fichiers utilisateurs ; elle doit être exécutée pendant une fenêtre de maintenance.

## 10. Déploiement et retour arrière

Le workflow GitHub conserve Cloudflare Access + SSH. Il exécute les tests, construit les images, sauvegarde la version active, met le clone à jour, lance les migrations, redémarre Compose et vérifie `/health`.

Si la santé échoue, le workflow revient automatiquement au commit précédent et reconstruit les anciennes images. Les volumes PostgreSQL, Users, Backups et Logs ne sont jamais supprimés.

Retour arrière manuel du code :

```sh
cd /mnt/DriveMaison/Database/deploy/apps/Otech-Maman_Cours_Padlet
sh scripts/backup.sh
git log --oneline -10
git reset --hard <commit-validé>
docker compose build frontend backend
docker compose up -d
curl -fsS http://127.0.0.1:30080/health
```

Ne restaurer PostgreSQL que si une migration incompatible le rend nécessaire, et uniquement depuis une sauvegarde validée.
