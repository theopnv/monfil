---
title: Soumettre un feedpack
description: Partagez une collection de flux avec d'autres lecteurs de Monfil.
---

Un feedpack est une collection de flux sur un sujet. Vous pouvez en créer un dans Monfil et le proposer au catalogue des feedpacks. Vous avez besoin d'un compte GitHub pour le soumettre, mais vous pouvez utiliser le site GitHub pour toutes les étapes.

Vous allez soumettre un fichier OPML avec les flux, et mettre à jour `feedpacks/index.json` pour décrire le pack. Une pull request demande au mainteneur de Monfil de relire ces changements. Votre pack apparaît dans le catalogue après son acceptation.

## 1. Créer le pack dans Monfil

1. Sélectionnez **+** dans la barre de gauche pour créer un workspace pour le sujet. Utilisez **+** en haut de la barre latérale des flux pour ajouter les flux que vous voulez partager. Placez-les dans des dossiers utiles.
2. Ouvrez chaque flux. Vérifiez qu'il publie du contenu et qu'il correspond au sujet. Supprimez les doublons et les flux cassés.
3. Faites un clic droit sur l'icône du workspace dans la barre de gauche et sélectionnez **Exporter au format OPML**.
4. Enregistrez le fichier avec un nom court composé de mots en minuscules reliés par des tirets, comme `web-performance.opml`.

OPML est le format de fichier que Monfil utilise pour transférer une liste de flux et de dossiers entre applications. L'export enregistre les flux de ce workspace.

## 2. Faire une copie du projet sur GitHub

1. [Créez un compte GitHub](https://github.com/signup) si vous n'en avez pas. Connectez-vous et ouvrez le [dépôt Monfil](https://github.com/theopnv/monfil).
2. Sélectionnez **Fork**, puis **Créer le fork**. GitHub crée une copie sous votre compte. [Le guide des forks de GitHub](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) montre des captures de ces boutons.
3. Dans votre fork, ouvrez le menu des branches au-dessus de la liste des fichiers. Il affiche **main** au départ. Saisissez un nom comme `add-web-performance-pack`, puis sélectionnez **Créer une branche**. Une branche contient les changements que vous voulez soumettre. Gardez-la sélectionnée pour les deux modifications de fichiers.

## 3. Importer le fichier OPML

1. Dans votre fork, ouvrez le dossier `feedpacks`.
2. Sélectionnez **Ajouter un fichier**, puis **Importer des fichiers**. Choisissez le fichier OPML exporté.
3. Enregistrez la modification sur la branche créée. GitHub peut nommer le bouton **Valider les modifications** ou **Proposer des modifications**. Un commit enregistre une modification dans votre copie.

## 4. Décrire le pack dans le catalogue

1. Restez dans votre fork et sur la même branche. Ouvrez `feedpacks/index.json`, puis sélectionnez l'icône en forme de crayon pour le modifier.
2. Ajoutez un objet dans la liste `packs`. Mettez une virgule entre votre objet et celui qui le précède. Utilisez cet exemple comme guide :

```json
{
  "slug": "web-performance",
  "title": "Web Performance",
  "description": "Browser performance, metrics, tooling, and field research.",
  "tags": ["web", "performance", "browsers"],
  "curator": "Your name or handle",
  "sourceCount": 12,
  "updatedAt": "2026-09-30",
  "opml": "web-performance.opml"
}
```

Remplacez les valeurs d'exemple par les vôtres. Donnez à `slug` une valeur unique parmi les packs existants, et faites correspondre `opml` exactement au nom de votre fichier. `sourceCount` est le nombre de flux, sans compter les dossiers. Mettez dans `updatedAt` la date à laquelle vous avez vérifié les sources, au format `YYYY-MM-DD`. Utilisez une description courte et quelques mots-clés de recherche en minuscules. Gardez la valeur `version` racine telle quelle.

Enregistrez cette modification sur la même branche que le fichier OPML.

## 5. Demander une relecture

1. Revenez au [dépôt Monfil d'origine](https://github.com/theopnv/monfil). Sélectionnez **Pull requests**, puis **Nouvelle pull request**.
2. Sélectionnez **comparer entre les forks**. Définissez le dépôt de base sur `theopnv/monfil` et la branche de base sur `main`. Définissez **fork de tête** sur votre copie et **branche à comparer** sur la branche créée. [Le guide des pull requests de GitHub](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) montre cet écran.
3. Vérifiez **Fichiers modifiés**. Il doit afficher votre fichier OPML et votre modification de `feedpacks/index.json`.
4. Donnez à la demande un titre clair. Dans la description, indiquez ce que couvre le pack, comment vous avez choisi les flux, et si une source a besoin de contexte. Sélectionnez **Créer la pull request**.

GitHub vérifie que le fichier OPML existe et que `sourceCount` correspond à ses flux. Le mainteneur vérifie les sources, leur adéquation avec le sujet, et les détails du catalogue. Vous pouvez répondre aux questions dans la pull request et mettre à jour la même branche si des changements sont nécessaires.

Avant que le pack puisse être accepté, vous devez signer le [Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md). CLA Assistant ajoute un lien à votre pull request. Suivez ce lien pour signer.

## Si vous créez le fichier OPML vous-même

Utilisez OPML 2.0. Placez chaque dossier dans un `<outline>` et chaque flux dans un dossier. Chaque flux a besoin d'un titre, d'un `type` pris en charge et d'un `xmlUrl`. Vous pouvez utiliser un [feedpack existant](https://github.com/theopnv/monfil/tree/main/feedpacks) comme exemple.

Si vous travaillez sur le projet en local, exécutez `npm install`, puis `npm run check:feedpacks` avant de soumettre. Cette commande vérifie les noms de fichiers du catalogue et le nombre de sources. Ouvrez vous-même les flux pour vérifier que leurs URL fonctionnent et que le contenu correspond à votre pack.
