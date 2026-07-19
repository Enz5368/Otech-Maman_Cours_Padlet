# Plan de migration

## Phase 1 — Gel et observation

- Conserver une capture visuelle de référence.
- Tester les identifiants DOM, libellés et ordre des menus.
- Documenter les clés `localStorage` et le schéma historique.

## Phase 2 — Extraction sans changement visible

- Extraire CSS et JavaScript sans modification sémantique.
- Ajouter le client API avant le script applicatif.
- Comparer le contrat DOM et la capture de connexion.

## Phase 3 — Serveur et comptes

- Déployer PostgreSQL et exécuter les migrations versionnées.
- Amorcer `rose` avec un mot de passe fourni par secret d'environnement.
- Forcer son changement après la première connexion.
- Utiliser Argon2id et une session opaque hachée en base.

## Phase 4 — Données locales

- Détecter `italia-html-data-v2-<username>` après authentification.
- Créer une copie locale datée avant envoi.
- Envoyer un identifiant d'idempotence et le document complet.
- Extraire les fichiers `data:`, normaliser les entités et comparer les compteurs.
- Conserver les anciennes clés jusqu'à confirmation explicite.

## Phase 5 — Fichiers

- Placer les fichiers sous `/mnt/DriveMaison/Users/<uuid>/<catégorie>`.
- Enregistrer uniquement les métadonnées et chemins relatifs en base.
- Servir les contenus par identifiant après contrôle du propriétaire, avec Range Requests.

## Phase 6 — Mise en production

- Sauvegarder PostgreSQL, fichiers et manifeste.
- Construire et lancer les conteneurs.
- Exécuter les migrations, vérifier `/health` et `/ready`.
- Restaurer le commit et les images précédentes si la vérification échoue.

