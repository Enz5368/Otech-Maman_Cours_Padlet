# In viaggio per l'Italia - Depot

Application web Next.js pour organiser un depot pedagogique d'italien : classes, sequences, seances, activites, ressources multimedia et actualites.

## Fonctionnalites

- Mode editeur protege par mot de passe avec session admin.
- Structure : Classe > Sequence > Seance > Activite > Ressources.
- Depot global pour audios, videos, affiches, PDF, documents et liens.
- Dashboard admin avec formulaires, suppression confirmee, ordre par glisser-deposer et upload.
- Base SQLite via Prisma.
- Fichiers stockes dans `uploads/` et servis par la route `/uploads/[filename]`.

## Installation

Installez d'abord Node.js, puis lancez :

```bash
npm install
```

Copiez le fichier d'exemple d'environnement :

```bash
cp .env.example .env
```

Sous Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

## Configuration

Dans `.env`, renseignez au minimum :

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="votre-mot-de-passe"
SESSION_SECRET="une-longue-chaine-aleatoire"
```

Ne mettez jamais `ADMIN_PASSWORD` dans le code front. Il est lu uniquement cote serveur.

## Base de donnees

Generez le client Prisma et creez la base SQLite :

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Ajoutez les donnees de demonstration :

```bash
npm run prisma:seed
```

Les modeles principaux sont dans `prisma/schema.prisma` :

- `Class`
- `Sequence`
- `Session`
- `Activity`
- `Resource`
- `News`

## Lancement

```bash
npm run dev
```

Si Node.js n'est pas installe globalement mais que la version portable du projet est presente, lancez sous PowerShell :

```powershell
.\start-dev.ps1
```

Ouvrez ensuite :

- Editeur : `http://localhost:3000/admin`

## Uploads

Les fichiers ajoutes depuis le dashboard sont enregistres dans :

```text
uploads/
```

Formats acceptes : MP3, WAV, MP4, JPG, PNG, WEBP, PDF, DOC et DOCX.

Les donnees de demonstration pointent vers des noms d'exemples comme `exemple-fiche.pdf` ou `exemple-audio.mp3`. Vous pouvez ajouter vos vrais fichiers depuis l'interface editeur.

## Utilisation editeur

1. Connectez-vous sur `/admin` avec `ADMIN_PASSWORD`.
2. Gerez les classes, actualites et ressources depuis la sidebar.
3. Utilisez l'arborescence pour ajouter des sequences, seances et activites.
4. Utilisez la case `Visible` pour marquer un element comme actif ou masque.
5. Glissez-deposez une ressource pour l'uploader, puis enregistrez la fiche.

## Production

Avant une mise en ligne :

- Choisissez un `ADMIN_PASSWORD` robuste.
- Choisissez un `SESSION_SECRET` long et aleatoire.
- Sauvegardez le fichier SQLite et le dossier `uploads/`.
- Verifiez que le dossier `uploads/` est persistant chez l'hebergeur.
