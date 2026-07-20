# MON ESPACE PROF — Cartable numérique

Portail pédagogique multi-utilisateur permettant de préparer, organiser, projeter et imprimer des cours. Le site public est déployé automatiquement sur TrueNAS après chaque push validé sur la branche `main`.

- Site : [monespaceprof.com](https://monespaceprof.com)
- Dépôt : [Enz5368/Otech-Maman_Cours_Padlet](https://github.com/Enz5368/Otech-Maman_Cours_Padlet)
- Déploiements : [GitHub Actions](https://github.com/Enz5368/Otech-Maman_Cours_Padlet/actions)
- Branche de production : `main`

## Ce qui est actuellement livré

- identité **MON ESPACE PROF · Cartable numérique** sur la connexion et dans l'application ;
- accès rapides vers Pronote et la messagerie académique ;
- répertoire d'outils pédagogiques : téléchargement vidéo, QuizWizard, Digistorm, Pictofacile, DigiView, Cap'FALC, MyDys, DysFacile et DigiPad ;
- numérotation claire des séquences et suppression du doublon de numéro sur les niveaux ;
- roue de tirage avec explication, absences, limite par élève et historique ;
- chrono analogique et numérique : cadran blanc, trace verte pendant les deux premiers tiers, puis rouge pendant le dernier tiers, alignée derrière l'aiguille ;
- ordre des niveaux réellement conservé après enregistrement dans une catégorie ;
- impression d'une activité ou de toute une séance depuis l'arbre ;
- gestion des classes, séquences, séances, activités, ressources et présentations ;
- comptes séparés, stockage privé, sauvegardes et restauration ;
- tests, construction Docker, sauvegarde et déploiement TrueNAS automatiques.

Principaux commits de cette mise à jour :

- `1582777` — outils, numérotation, impression, roue et correction du tri ;
- `327850c` — titre « MON ESPACE PROF » et nouveau cadran du chrono ;
- `12509c2` — alignement de la trace colorée avec l'aiguille.

## Architecture

- frontend HTML/CSS/JavaScript dans `index.html` et `assets/` ;
- API FastAPI versionnée sous `/api/v1` dans `backend/` ;
- PostgreSQL comme source principale et Redis pour les services internes ;
- sessions serveur opaques, mots de passe Argon2id et cookies HTTP-only ;
- fichiers privés sous `/mnt/DriveMaison/Users/<uuid>` en production ;
- Nginx local en HTTP sur le port `30080` ;
- HTTPS public fourni exclusivement par Cloudflare ;
- sauvegardes utilisateur et PostgreSQL automatiques.

## Installer un nouvel ordinateur

Cette partie est à effectuer une seule fois sur chaque ordinateur.

### 1. Installer les outils

Installer :

- [Git](https://git-scm.com/downloads) ;
- [Python 3.12 ou supérieur](https://www.python.org/downloads/) ;
- [GitHub CLI](https://cli.github.com/) ;
- un éditeur, par exemple VS Code ;
- Docker Desktop uniquement si l'environnement Docker complet doit être lancé localement.

Vérifier l'installation dans PowerShell :

```powershell
git --version
python --version
gh --version
```

### 2. Autoriser le compte GitHub

Le compte utilisé doit être propriétaire du dépôt ou avoir le droit **Write**. Pour ce dépôt, le compte attendu est normalement `Enz5368`.

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
gh api user --jq .login
gh repo view Enz5368/Otech-Maman_Cours_Padlet --json viewerPermission --jq .viewerPermission
```

Résultat attendu :

- `gh auth status` indique une connexion valide à `github.com` ;
- `gh api user` affiche le bon identifiant ;
- la permission du dépôt vaut `WRITE`, `MAINTAIN` ou `ADMIN`.

`gh auth setup-git` configure Git pour réutiliser l'authentification de GitHub CLI. Cela évite qu'un push fonctionne dans Git mais que les commandes `gh` échouent, ou inversement. Ne jamais afficher, copier ou enregistrer le jeton d'authentification dans le dépôt.

Documentation officielle : [connexion avec GitHub CLI](https://cli.github.com/manual/gh_auth_login) et [configuration de Git comme gestionnaire d'identifiants](https://cli.github.com/manual/gh_auth_setup-git).

### 3. Configurer l'auteur des commits

À faire avec votre nom et l'adresse associée à votre compte GitHub :

```powershell
git config --global user.name "Votre nom"
git config --global user.email "votre-adresse@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
```

Vérifier :

```powershell
git config --global --list
```

### 4. Cloner le dépôt

Ne pas copier le dossier `.git` avec une clé USB, OneDrive ou un autre outil de synchronisation. Chaque ordinateur doit posséder son propre clone.

```powershell
cd "C:\Users\VOTRE_NOM\Documents"
gh repo clone Enz5368/Otech-Maman_Cours_Padlet
cd Otech-Maman_Cours_Padlet
git remote -v
git status -sb
```

Le remote doit être :

```text
https://github.com/Enz5368/Otech-Maman_Cours_Padlet.git
```

GitHub explique le clonage et la synchronisation dans sa [documentation officielle](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).

### 5. Installer l'environnement de test

Sous Windows/PowerShell :

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".\backend[test]"
```

Sous macOS/Linux :

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e "./backend[test]"
```

Le dossier `.venv` reste local et ne doit jamais être ajouté à Git.

## Routine sûre pour modifier et pousser

Suivre ces étapes à chaque session, surtout lorsque plusieurs ordinateurs sont utilisés.

### 1. Récupérer la dernière version avant de modifier

```powershell
git switch main
git status -sb
git pull --ff-only origin main
```

Ne commencer les modifications que si `git status` ne montre aucun fichier inattendu. Cette étape empêche de travailler sur une ancienne version.

### 2. Modifier le site

Les fichiers principaux sont :

- `index.html` : structure générale, connexion et menu ;
- `assets/app.js` : données, écrans et comportements ;
- `assets/styles.css` : apparence ;
- `assets/api-client.js` : appels vers l'API ;
- `backend/app/` : serveur ;
- `tests/` et `backend/tests/` : tests.

Quand `app.js` ou `styles.css` change, incrémenter aussi le suffixe `?v=` de ces fichiers dans `index.html`. Cela force les navigateurs à charger la nouvelle version au lieu d'une ancienne copie en cache.

### 3. Tester avant chaque push

Depuis la racine du dépôt :

```powershell
python -m ruff check backend/app backend/tests tests scripts
python -m pytest backend/tests tests
git diff --check
```

Résultat attendu actuellement : `62 passed` et `All checks passed!`. Ne pas pousser si un test échoue.

### 4. Vérifier exactement ce qui sera envoyé

```powershell
git status --short
git diff
```

Ajouter uniquement les fichiers voulus, par exemple :

```powershell
git add -- index.html assets/app.js assets/styles.css tests/test_ui_contract.py
git diff --cached --check
git diff --cached --stat
```

Éviter `git add -A` lorsqu'il existe des modifications sans rapport avec le travail en cours.

### 5. Créer le commit

```powershell
git commit -m "Décrit brièvement la modification"
```

Un commit doit correspondre à une modification cohérente. Ne jamais mettre de mot de passe, `.env`, clé SSH, jeton GitHub ou secret Cloudflare dans un commit.

### 6. Resynchroniser puis pousser en production

Après le commit :

```powershell
git pull --rebase origin main
python -m pytest backend/tests tests
git push origin main
```

Le `pull --rebase` récupère un éventuel commit envoyé depuis un autre ordinateur juste avant le push, sans créer de commit de fusion inutile. Ne jamais utiliser `git push --force` sur `main`.

GitHub documente le fonctionnement de [`git push`](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository).

### 7. Attendre le vrai résultat du déploiement

Un push réussi ne signifie pas encore que le site est déployé. Ouvrir la page Actions :

```powershell
gh run list --branch main --workflow deploy.yml --limit 5
gh run watch --exit-status
```

On peut aussi ouvrir directement [GitHub Actions](https://github.com/Enz5368/Otech-Maman_Cours_Padlet/actions).

Le workflow **Tester et déployer sur TrueNAS** doit se terminer en vert. Il :

1. installe les dépendances ;
2. exécute Ruff et les tests ;
3. valide Docker Compose ;
4. construit les images ;
5. sauvegarde la version active sur TrueNAS ;
6. déploie le commit exact ;
7. redémarre les services ;
8. contrôle `/health` et vérifie que le bon `index.html` est servi ;
9. revient automatiquement au commit précédent si le déploiement échoue.

Les secrets SSH, TrueNAS et Cloudflare sont stockés dans GitHub Actions. Ils ne doivent pas être copiés sur le nouvel ordinateur et ne doivent jamais apparaître dans le dépôt.

## Résumé à copier-coller pour une modification normale

```powershell
git switch main
git pull --ff-only origin main

# Modifier les fichiers, puis :
python -m ruff check backend/app backend/tests tests scripts
python -m pytest backend/tests tests
git diff --check
git status --short
git diff

git add -- CHEMIN_DU_FICHIER_1 CHEMIN_DU_FICHIER_2
git diff --cached --check
git commit -m "Description courte"
git pull --rebase origin main
git push origin main

gh run list --branch main --workflow deploy.yml --limit 5
gh run watch --exit-status
```

## Travailler sur deux ordinateurs sans conflit

- toujours terminer une session par un commit et un push ;
- toujours commencer la session suivante par `git pull --ff-only origin main` ;
- ne pas modifier les mêmes fichiers simultanément sur deux ordinateurs ;
- ne jamais synchroniser le dossier du dépôt avec OneDrive pendant que Git travaille ;
- vérifier `git status -sb` avant et après chaque opération ;
- si une longue modification est en cours, utiliser une branche dédiée au lieu de `main`.

Pour une branche dédiée :

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/description-courte

# Modifier, tester, ajouter et committer.
git push -u origin feature/description-courte
gh pr create --base main --fill
```

Une PR (« Pull Request ») propose de fusionner cette branche dans `main`. Elle est utile pour relire ou tester une grosse modification avant la mise en production. Pour une petite correction faite par le propriétaire, le workflow direct sur `main` ci-dessus reste le plus simple.

## Résoudre les problèmes de push

### `gh auth status` indique que vous n'êtes pas connecté

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Si plusieurs comptes GitHub sont enregistrés :

```powershell
gh auth switch --hostname github.com --user Enz5368
```

### Erreur `403` ou `Repository not found`

Vérifier le compte, sa permission et le remote :

```powershell
gh api user --jq .login
gh repo view Enz5368/Otech-Maman_Cours_Padlet --json viewerPermission --jq .viewerPermission
git remote -v
```

Corriger le remote si nécessaire :

```powershell
git remote set-url origin https://github.com/Enz5368/Otech-Maman_Cours_Padlet.git
gh auth setup-git
```

### Push refusé avec `non-fast-forward`

Cela signifie qu'un autre ordinateur a poussé avant vous. GitHub refuse l'opération pour protéger l'historique. Ne pas forcer le push.

Si vos modifications sont déjà committées :

```powershell
git fetch origin
git rebase origin/main
```

En cas de conflit, ouvrir les fichiers indiqués par `git status`, choisir la bonne version, puis :

```powershell
git add -- CHEMIN_DU_FICHIER_CORRIGE
git rebase --continue
```

Après le rebase :

```powershell
python -m pytest backend/tests tests
git push origin main
```

La procédure correspond aux recommandations GitHub pour les [erreurs non-fast-forward](https://docs.github.com/en/get-started/using-git/dealing-with-non-fast-forward-errors).

### Des fichiers sont modifiés avant le `pull`

Option recommandée : terminer et committer le travail avant de récupérer `main`.

Pour mettre provisoirement le travail de côté :

```powershell
git stash push -u -m "travail temporaire"
git pull --ff-only origin main
git stash pop
```

Vérifier ensuite attentivement `git status` et retester.

### Un mauvais fichier a été ajouté au commit

Avant le commit :

```powershell
git restore --staged -- CHEMIN_DU_FICHIER
```

Ne pas utiliser `git reset --hard` : cette commande peut supprimer définitivement du travail local.

### GitHub bloque un secret

Ne jamais contourner la protection. Retirer immédiatement le secret du fichier et du commit, remplacer le secret compromis dans le service concerné, puis recommencer le commit. Les mots de passe et clés vont dans `.env` local ou dans les secrets GitHub Actions, jamais dans Git.

### Le push réussit mais le site n'est pas à jour

1. vérifier que le commit est bien sur `main` avec `git log -1 --oneline` ;
2. consulter le workflow GitHub Actions ;
3. attendre qu'il soit vert ;
4. vérifier que la version `?v=` des assets a été incrémentée ;
5. recharger la page avec `Ctrl+F5`.

## Développement local

Pour lancer uniquement l'API avec SQLite :

```powershell
$env:MEP_ENVIRONMENT="development"
$env:MEP_DATABASE_URL="sqlite:///./monespaceprof-dev.db"
uvicorn app.main:app --app-dir backend --reload
```

Le frontend doit être servi par un serveur HTTP pour utiliser `/api/v1`. L'environnement Docker Compose reproduit le routage de production. Pour une simple vérification visuelle sans serveur, `index.html` possède aussi un mode local autonome ; ses données restent dans le navigateur.

## Production et sécurité

- ne jamais committer `.env` ;
- ne jamais afficher un jeton avec `gh auth token` ou `gh auth status --show-token` ;
- ne jamais pousser avec `--force` sur `main` ;
- ne jamais exécuter un `reset --hard` sans sauvegarde et cible vérifiée ;
- ne jamais supprimer les volumes PostgreSQL, Users, Backups ou Logs ;
- ne jamais pointer Cloudflare vers `https://192.168.1.30:30080` : l'origine reste `http://192.168.1.30:30080`.

Pour l'exploitation, les sauvegardes et les retours arrière, suivre [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Documentation complémentaire

- [Audit initial](docs/AUDIT_INITIAL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Plan de migration](docs/PLAN_MIGRATION.md)
- [API](docs/API.md)
- [Exploitation TrueNAS](docs/OPERATIONS.md)
- [Sécurité](docs/SECURITY.md)
