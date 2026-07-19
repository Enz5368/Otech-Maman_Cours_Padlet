# Audit initial de MonEspaceProf

Date de l'audit : 2026-07-19  
Branche de référence : `main` au commit `0f0c3f5`

## Structure actuelle

- `index.html` : application complète (HTML, CSS et JavaScript), environ 156 Ko.
- `uploads/demo-leonardo.mp4` : vidéo de démonstration.
- `.github/workflows/deploy.yml` : copie du dépôt vers le répertoire Nginx du NAS.
- `netlify.toml` : ancien hébergement statique, sans rôle dans la cible TrueNAS.
- `README.md` : documentation du fonctionnement local historique.

Il n'existe initialement aucun backend, gestionnaire de dépendances, service d'authentification, API ou base de données.

## Fonctions existantes

- Connexion locale et création implicite d'un espace par identifiant.
- Arborescence niveau → séquence → séance → activité → diapositives/ressources.
- Deux parcours séparés : cours à projeter et cours modifiables.
- Studio 16:9 de 960 × 540 px avec texte, image, vidéo, audio, URL et fichier.
- Mode tableau avec navigation précédente/suivante et plein écran.
- Groupes de classes et listes d'élèves.
- Roue de tirage, absences, compteurs, historique et chronomètre.
- Recherche locale, tutoriel et démonstration Leonardo da Vinci.
- Import/export JSON, ZIP et génération PPTX locale.

## Stockage navigateur existant

| Clé | Contenu | Risque |
| --- | --- | --- |
| `italia-html-accounts-v1` | identifiants et mots de passe en clair | critique |
| `italia-html-current-user` | identifiant courant | usurpable |
| `italia-html-data-v2-<username>` | espace pédagogique complet | lié à un navigateur |
| `italia-html-public-demo-v1` | démonstration publique | faible |
| `sessionStorage:italia-html-current-user` | session locale | non authentifiée côté serveur |

Les fichiers locaux peuvent être encodés en URL `data:` dans le JSON, ce qui augmente fortement la taille du stockage et ne permet pas le streaming.

## Invariants visuels et fonctionnels

- Écrans racines : `loginPage`, `appPage`, `boardPage`.
- Menu, dans cet ordre : cours à projeter, cours modifiables, groupes, outils, recherche, tutoriel, réglages.
- Composants et classes CSS existants : cartes, tiroirs/modales, notifications, studio et tableau.
- Dimensions logiques des diapositives : 960 × 540 px, intervalle 36 px.
- Le mode tableau ne rend jamais `privateNotes`.
- Les libellés, couleurs, polices, tailles, boutons, interactions et responsive sont contractuels.

## Déploiement actuel

Le workflow GitHub Actions utilise Cloudflare Access et SSH, met le clone NAS à jour, puis exécute `rsync --delete` vers `/mnt/DriveMaison/Sites/monespaceprof`. La chaîne d'accès doit être conservée, mais la copie destructive doit être remplacée par un déploiement Docker Compose utilisant des volumes persistants externes au dépôt.

## Risques prioritaires

1. Mots de passe en clair et absence d'authentification serveur.
2. Aucune isolation fiable entre professeurs.
3. Perte des données lors d'un nettoyage du navigateur ou d'un changement d'appareil.
4. Fichiers lourds chargés en mémoire et stockés en base64.
5. Absence de validation, protection CSRF, limitation de débit et journal d'audit.
6. Aucune sauvegarde PostgreSQL/utilisateur ni procédure de restauration.
7. Déploiement statique incompatible avec des données persistantes.

## Décision d'architecture

Le DOM et le CSS existants restent la référence. Le frontend est extrait mécaniquement, puis raccordé à une API FastAPI versionnée. PostgreSQL devient la source principale. Une représentation JSON versionnée assure la compatibilité immédiate du frontend, tandis que les entités sont également normalisées dans les tables relationnelles. Les fichiers sont extraits du JSON et placés sous un répertoire UUID propre à l'utilisateur.

