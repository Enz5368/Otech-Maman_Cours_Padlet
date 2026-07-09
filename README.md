# In viaggio per l'Italia

Site HTML autonome pour une professeure d'italien.

Il sert de portail prive local pour organiser les classes, sequences, seances, activites et ressources, puis afficher une activite en mode tableau.

## Ouvrir en local

Double-cliquer sur `index.html`, ou lancer depuis PowerShell :

```powershell
start .\index.html
```

## Connexion

- Identifiant : `rose`
- Mot de passe : `it`

Un nouvel identifiant peut aussi etre saisi : au premier login, son espace local est cree avec le mot de passe choisi. Ensuite, ce meme identifiant retrouvera uniquement ses propres donnees.

## Fonctionnement

- Tout est dans un seul fichier HTML.
- Les donnees sont stockees par identifiant dans le navigateur avec `localStorage`.
- La session locale utilise `sessionStorage`.
- Il n'y a pas de mode eleve public.
- Le mode tableau affiche uniquement les informations utiles en classe.
- Les notes privees de la prof ne sont jamais affichees en mode tableau.

## Contenu inclus

- Tableau de navigation pour retrouver et presenter une activite
- Gestion des classes
- Gestion de `Mes Classes` avec les noms des eleves
- Outils de classe, dont une roue par classe avec historique des tirages
- Gestion des sequences
- Gestion des seances
- Activites sous forme de presentations en diapos
- Studio de creation avec une grande zone horizontale et des cadres pointilles
- Ajout libre de texte, fichiers et URL dans les diapos
- Ressources attachees aux activites
- Depot de ressources general
- Recherche globale
- Reglages
- Export/import JSON des donnees
- Export ZIP local avec toutes les classes, sequences, seances et presentations, dont un fichier PPTX par activite

## Donnees de demonstration

Contenu cree au depart :

- Classe exemple
- Sequence exemple
- Seance exemple
- Presentation exemple

## Note importante

Comme c'est un site HTML autonome, il n'y a pas de vrai serveur. Les comptes separent les donnees dans ce navigateur, mais pour une securite serveur reelle il faudrait une application avec backend.

## Activites

La page `Tableau` sert a choisir une classe, une sequence, une seance puis une activite a presenter. Elle ne contient pas de boutons de modification.

Une activite se modifie dans le studio de diapos : les cadres pointilles sont empiles verticalement et chaque cadre correspond a ce qui sera visible au tableau. Les elements peuvent etre deplaces et redimensionnes. Un element peut depasser d'une diapo vers la suivante, ce qui permet par exemple d'afficher une longue page web sur plusieurs diapos consecutives. Les fichiers sont ouverts directement dans la diapo quand le navigateur le permet. Les liens web et videos sont integres dans une zone d'affichage.
