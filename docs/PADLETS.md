# Padlets pédagogiques

Les professeurs retrouvent leurs murs dans **Padlets**, depuis l’accueil, ou avec **Créer un Padlet** dans une séance. La page de connexion propose **Ouvrir un Padlet** pour saisir le lien reçu. Les élèves peuvent aussi ouvrir directement `/padlet/<slug>` sans compte. Toute la navigation reste dans le même onglet.

## Utilisation

1. Donner un titre, choisir un lien, un fil vertical ou un mur horizontal et l’accès avec ou sans mot de passe.
2. Ajouter textes, consignes, images, vidéos, Word, PDF, liens ou fichiers. Un Word peut être créé et modifié dans l’éditeur existant, avec enregistrement manuel.
3. Cliquer sur **Publier**, puis **Partager** pour copier le lien. Un brouillon ou un mur archivé est inaccessible aux visiteurs.
4. Déplacer les cartes avec Avant/Après ou par glisser-déposer. Masquer une carte la retire immédiatement du mur public. Les cartes supprimées passent dans une corbeille et peuvent être restaurées ou supprimées définitivement.

Les quatre fonds reprennent les couleurs du cartable : papier, bordeaux, lagon et sauge. Les vidéos importées sont lues par le navigateur ; un téléchargement reste possible si son codec n’est pas pris en charge. Les vidéos YouTube et Vimeo s’ouvrent dans un lecteur intégré après un clic. Aucun contenu distant n’est téléchargé par le serveur pour fabriquer des aperçus.

## Données et droits

- `padlets` : propriétaire (`user_id`), titre, slug global unique, description, présentation, fond, publication, archivage, séance historique facultative, révision et version d’accès.
- `padlet_posts` : texte ou fichier, type, description, consigne, position, visibilité et corbeille.
- `padlet_grants` : session anonyme opaque de 12 heures, dont seul le SHA-256 est stocké, liée à un seul mur et à sa version d’accès.
- `padlet_attempts` : compteurs de tentatives persistants et partagés entre workers. Un succès ne consomme pas les tentatives des élèves qui partagent une connexion réseau.

La migration `008_padlets.sql` est additive. Les cours et leur JSON historique restent indépendants. Les sauvegardes globales PostgreSQL + fichiers incluent les Padlets ; l’export JSON historique d’un cours ne contient pas les murs indépendants.

Les écritures professeur utilisent la session et le CSRF existants. Toutes les requêtes privées vérifient le propriétaire. Le mot de passe est haché avec Argon2id. Les réponses publiques sont explicitement filtrées ; elles ne contiennent ni compte professeur, ni hash, ni chemin de stockage, ni identifiant de fichier privé.

Les autorisations élèves sont des cookies HttpOnly, Secure en production, SameSite Strict. Changer le mot de passe, le lien, l’accès, la publication ou l’archivage invalide les autorisations précédentes. **Quitter** révoque la session du mur. Chaque requête de fichier, y compris une plage vidéo, vérifie l’état du mur, de la carte et de l’autorisation. Aucune route de fichiers professeur n’est rendue publique. Les réponses ne sont pas mises en cache et les routes publiques ont `noindex, nofollow, noarchive`.

Les textes sont insérés avec les API DOM, sans interprétation HTML. Les liens sont limités à HTTP(S) ; les lecteurs externes sont reconstruits depuis des identifiants YouTube/Vimeo validés. SVG est refusé dans les uploads des murs. Les autres validations et quotas réutilisent le stockage existant.

## API `/api/v1`

| Route | Fonction |
|---|---|
| `GET, POST /padlets` | Liste privée et création |
| `GET, PUT, DELETE /padlets/{id}` | Lire, enregistrer ou supprimer son mur |
| `POST /padlets/{id}/duplicate` | Copier en brouillon |
| `POST /padlets/{id}/posts` | Ajouter une ressource (UUID client pour les réessais) |
| `PUT, DELETE /padlets/{id}/posts/{postId}` | Modifier ou mettre à la corbeille (`?permanent=true` pour vider) |
| `POST /padlets/{id}/posts/{postId}/restore` | Restaurer |
| `PUT /padlets/{id}/order` | Réordonner la liste complète |
| `POST /padlets/{id}/files` | Upload soumis aux quotas existants |
| `GET /public/padlets/{slug}` | Mur publié et cartes visibles |
| `POST /public/padlets/{slug}/unlock` | Contrôler le mot de passe et autoriser la visite |
| `POST /public/padlets/{slug}/lock` | Révoquer l’autorisation de cette visite |
| `GET /public/padlets/{slug}/posts/{postId}/content` | Fichier soumis au même contrôle d’accès, avec Range et `?download=true` |

## Vérification et limites

`backend/tests/test_padlets.py` couvre droits, publication, mots de passe, révocation, fichiers et plages, limites, corbeille, ordre et liens dangereux. `node tests/padlets-smoke.mjs` démarre une vraie API locale et vérifie le parcours navigateur professeur/élève, le Word natif, le PDF, la vidéo, l’image, le lien, le défilement, le mobile et la persistance. Les anciennes suites Word et cours restent exécutées.

La CI teste les migrations sur PostgreSQL 17. Après déploiement, `python -m scripts.verify_padlets` vérifie les routes HTTPS réellement publiques avec des données techniques temporaires, puis supprime uniquement son compte et ses données de test.

Limites : 100 murs par professeur, 200 cartes (corbeille comprise) par mur, Word 30 Mo, autres fichiers 250 Mo, dans le quota existant. Pas de commentaires ni de publication par les élèves. Pas de synchronisation temps réel : les élèves rechargent pour voir les modifications. Aucun service ne peut garantir une disponibilité absolue ; les murs sont persistants et accessibles tant que l’hébergement fonctionne et qu’ils sont publiés.
