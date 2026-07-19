# MonEspaceProf

Portail pédagogique multi-utilisateur pour préparer, organiser et projeter des cours tout en conservant l'interface historique « In viaggio per l'Italia ».

## Architecture

- Frontend HTML/CSS/JavaScript historique, rendu inchangé.
- API FastAPI versionnée sous `/api/v1`.
- PostgreSQL comme source principale.
- Sessions serveur opaques, mots de passe Argon2id et cookies HTTP-only.
- Fichiers privés sous `/mnt/DriveMaison/Users/<uuid>`.
- Nginx local en HTTP sur le port `30080`.
- HTTPS public exclusivement fourni par Cloudflare.
- Sauvegardes utilisateur et PostgreSQL automatiques.

La documentation complète se trouve dans :

- [audit initial](docs/AUDIT_INITIAL.md) ;
- [architecture](docs/ARCHITECTURE.md) ;
- [plan de migration](docs/PLAN_MIGRATION.md) ;
- [API](docs/API.md) ;
- [mise en production et restauration](docs/OPERATIONS.md) ;
- [sécurité](docs/SECURITY.md).

## Développement local

Python 3.12 ou supérieur est requis.

```powershell
python -m pip install -e ".\backend[test]"
$env:MEP_ENVIRONMENT="development"
$env:MEP_DATABASE_URL="sqlite:///./monespaceprof-dev.db"
uvicorn app.main:app --app-dir backend --reload
```

Le frontend doit être servi par un serveur HTTP afin que `/api/v1` soit accessible. L'environnement Docker Compose reproduit le routage de production.

## Tests

```powershell
ruff check backend\app backend\tests tests scripts
pytest backend\tests tests
```

Les tests vérifient notamment l'isolation des professeurs, les fichiers privés, Argon2id, la migration idempotente et les invariants DOM. La capture de référence de la page de connexion se trouve dans `tests/visual/baseline-login.png`.

## Production

Consulter [docs/OPERATIONS.md](docs/OPERATIONS.md). Ne jamais pointer Cloudflare vers `https://192.168.1.30:30080` : l'origine locale reste `http://192.168.1.30:30080`.
