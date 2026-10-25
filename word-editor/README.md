# Éditeur Word intégré

Créer / importer un `.docx` depuis une séance ouvre un document natif, sans conversion en image ou en HTML. L'éditeur et ses polices sont servis par le site ; aucun service d'édition externe ni télémétrie n'est configuré.

## Construire

```sh
cd word-editor
npm ci
npm run build
```

Les fichiers compilés dans `assets/word-editor` sont versionnés et inclus dans l'image frontend existante. `build.mjs` copie les polices, le moteur WebAssembly de mesure et les licences. La politique CSP autorise uniquement la compilation WebAssembly, pas `eval` JavaScript.

## Vérifier

```sh
npx playwright install chromium
node smoke.mjs
```

Le test démarre un serveur temporaire avec la CSP de production. Il vérifie création, saisie, gras, export OOXML, position après sauvegarde, réouverture, échec et nouvelle tentative, confirmation de fermeture, import et téléchargement. Les sauvegardes sont simulées dans ce test ; `backend/tests/test_word_documents.py` vérifie le stockage API et l'isolation entre comptes.

## Fonctionnement

- Les modifications restent dans l'éditeur jusqu'à Enregistrer, Ctrl+S ou la confirmation de fermeture.
- La barre Portrait / Paysage cible par défaut la page du curseur ; « Tout le document » change toutes les pages. Les limites de la page sont converties en sections OOXML dans une seule transaction annulable, sans sauvegarde ni rechargement. La pagination peut évoluer si le contenu ne tient plus dans la nouvelle hauteur. Une limite au milieu d'un tableau doit d'abord être séparée en dehors du tableau ; l'opération est refusée sans mutation plutôt que de couper les cellules.
- L'enregistrement utilise l'API de fichiers privée existante puis la révision du workspace. Aucune reconstruction du composant après sauvegarde.
- Un nouvel import/création n'est ajouté à la séance qu'après sauvegarde. Fermer sans enregistrer n'ajoute aucun contenu.
- En cas d'échec, le document reste ouvert ; une nouvelle tentative réutilise le fichier déjà envoyé tant que son contenu n'a pas changé.
- Téléchargement `.docx` possible sans enregistrer sur le serveur. Les documents téléchargés restent éditables dans Word et LibreOffice.
- Formats d'entrée : `.docx` (30 Mo maximum). Les anciens `.doc` et les `.odt` doivent d'abord être enregistrés en `.docx`. Les macros ne sont pas prises en charge.
- L'éditeur n'est pas Microsoft Word : des polices absentes, fonctions avancées ou mises en page complexes peuvent différer. Les polices fournies sont des substituts libres aux métriques compatibles. Le suivi des modifications et les commentaires commerciaux ne sont pas activés.

## Dépendances

`@docx-editor.dev/react`, `core`, `fonts` et `i18n` : versions épinglées dans `package-lock.json`, licence Apache-2.0 et licences spécifiques des polices. Notices livrées dans `assets/word-editor/THIRD-PARTY-LICENSES.txt` et `assets/word-editor/fonts`.

Documentation primaire : [chargement et sauvegarde](https://www.docx-editor.dev/docs/2.x/guides/loading-and-saving), [adaptateur React](https://www.docx-editor.dev/docs/latest/react).
