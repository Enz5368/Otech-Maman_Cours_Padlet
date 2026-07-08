# In viaggio per l'Italia - Studio HTML

Site HTML autonome pour organiser les classes, sequences, seances, activites, actualites et ressources.

## Lancement

Ouvrez simplement :

```text
index.html
```

Aucune installation Node.js n'est necessaire.

## Connexion

- Identifiant : `rose`
- Mot de passe : `italia`

## Donnees

Les modifications sont sauvegardees dans le navigateur avec `localStorage`.

Pour garder une copie portable :

1. Ouvrez l'onglet `Sauvegarde`.
2. Copiez le JSON.
3. Gardez ce texte dans un fichier a part.

Pour restaurer une sauvegarde, collez le JSON dans le meme onglet puis cliquez sur `Importer`.

## Publication

Le fichier `netlify.toml` indique a Netlify de publier directement le dossier courant, sans commande de build.

Si Netlify garde une ancienne configuration dans son interface, utilisez :

- Build command : vide
- Publish directory : `.`
