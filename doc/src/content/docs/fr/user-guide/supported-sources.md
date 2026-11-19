---
title: Sources prises en charge
description: Ce que vous pouvez coller dans Ajouter un flux, et ce que Monfil suit pour chaque source.
---

Sélectionnez **+** en haut de la barre latérale des flux pour ouvrir **Ajouter un flux**. Collez un lien dans la zone. Monfil trouve le flux derrière le lien. Vous n'avez pas besoin de l'URL du flux lui-même.

Les pastilles sous la zone définissent le type de source. Gardez **Tout** pour que Monfil détecte le type à partir du lien. Choisissez une pastille quand Monfil ne peut pas le détecter, ou quand vous saisissez une forme courte comme un identifiant. Pour un identifiant, appuyez sur Entrée pour lancer la vérification.

Certains liens mènent à plusieurs flux. Monfil affiche alors une liste et sélectionne le premier flux. Sélectionnez celui que vous voulez, puis sélectionnez **Continuer**.

## Sites web et blogs

Collez l'adresse de n'importe quelle page du site. Monfil lit les liens de flux que la page annonce. Si la page n'en a aucun, Monfil essaie des adresses de flux courantes sur le même site, comme `/feed` et `/rss.xml`.

## GitHub

| Collez | Monfil suit |
| --- | --- |
| Un dépôt, comme `github.com/microsoft/playwright` | Les publications du dépôt |
| Un utilisateur ou une organisation, comme `github.com/torvalds` | L'activité publique |
| `owner/repo`, avec la pastille **GitHub** | Les publications du dépôt |

## GitLab

Collez un lien de projet, comme `gitlab.com/gitlab-org/gitlab`. Monfil suit les publications du projet. Pour un GitLab auto-hébergé, choisissez d'abord la pastille **GitLab**.

## Hacker News

Collez `news.ycombinator.com`. Monfil propose ces flux :

- **Page d'accueil**, depuis Hacker News lui-même. C'est la valeur par défaut.
- **100+ points** et **300+ points**, avec seulement les articles qui atteignent ce score.
- **Show HN** et **Ask HN**.

Les quatre derniers viennent de [hnrss.org](https://hnrss.org), un service gratuit qui ne fait pas partie de Hacker News. Un lien vers une rubrique, comme `news.ycombinator.com/show`, donne seulement cette rubrique.

## arXiv

Collez une liste de catégorie, comme `arxiv.org/list/cs.AI/recent`. Monfil suit les annonces quotidiennes de cette catégorie. Il masque les articles remplacés, car ce sont de nouvelles versions d'articles que vous avez déjà vus. arXiv ne publie pas le week-end.

## Bluesky et Mastodon sans compte

Vous n'avez pas besoin de compte Bluesky ou Mastodon pour suivre des personnes sur ces réseaux. Les deux réseaux publient un flux pour chaque profil public, et Monfil le lit. Voir [Cas d'usage](../use-cases/#suivre-des-personnes-sans-compte).

## Bluesky

Collez un lien de profil, comme `bsky.app/profile/bsky.app`, ou un identifiant, comme `@name.bsky.social`. Pour un identifiant sur un domaine personnalisé sans le `@`, choisissez la pastille **Bluesky**.

## Mastodon

Collez un identifiant, comme `@user@mastodon.social`. Vous pouvez aussi coller un lien de profil ou un lien d'étiquette depuis n'importe quel serveur, comme `hachyderm.io/@user` ou `hachyderm.io/tags/rust`.

## YouTube

Collez un lien de chaîne, d'identifiant, de vidéo ou de liste de lecture. Un lien vers une vidéo suit la chaîne qui l'a publiée.

## Conférences pour développeurs

Choisissez la pastille **Conférences**. Saisissez des thèmes, puis `in`, puis des lieux, et appuyez sur Entrée. Séparez les éléments de chaque liste par des virgules. Les lieux sont facultatifs. Utilisez `online` pour les événements en ligne.

| Type | Monfil suit |
| --- | --- |
| `devops` | Les conférences DevOps dans tous les lieux |
| `kubernetes, cloud in France` | Les conférences sur Kubernetes ou le cloud en France |
| `java in Belgium, online` | Les conférences Java en Belgique ou en ligne |

Un thème correspond à une étiquette de conférence, comme `java` ou `devops`. Monfil remplace les espaces d'un thème par des tirets, donc `software testing` trouve l'étiquette `software-testing`. Un lieu correspond à une ville ou à un pays.

Vous pouvez aussi coller un lien [developers.events](https://developers.events) sans la pastille. Définissez d'abord les filtres sur le site, puis copiez l'adresse. Monfil utilise les filtres de pays, de thème, de technologie et de langue. Il ignore l'année dans l'adresse et affiche les conférences de toutes les années. Si le lien contient un autre filtre, comme la région, Monfil vous demande de le retirer.

Si aucune conférence ne correspond à un thème ou à un lieu, Monfil vous le signale et suggère des correspondances proches. Par exemple, `test automation` suggère `testing`. Si le thème et le lieu sont corrects mais qu'aucune conférence ne correspond pour le moment, Monfil vous le dit. Vous pouvez quand même ajouter le flux. Il affiche une carte quand une conférence correspondante est annoncée.

Monfil ajoute une carte au fil quand l'un de ces événements se produit :

- Une conférence commence dans les 12 prochains mois.
- Son appel à communications (CFP) s'ouvre.
- Son CFP se ferme dans 14 jours.
- Elle commence dans 30 jours.
- Elle commence aujourd'hui.

Quand vous ajoutez le flux, vous recevez une carte pour chaque événement déjà survenu. Monfil lit les données de developers.events à chaque actualisation. Il ne garde pas de copie de la liste complète. Les données ont la licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), et chaque carte nomme sa source.

## Emplois

Choisissez la pastille **Emplois**. Collez la page d'offres d'une entreprise, comme `jobs.lever.co/spotify` ou `boards.greenhouse.io/datadog`. Vous pouvez aussi coller la page carrières de l'entreprise. Monfil cherche sur la page un lien vers une page d'offres prise en charge (cela ne fonctionne pas toujours).

Monfil lit les pages d'offres publiques de ces systèmes :

- Greenhouse
- Lever
- Ashby
- Workable
- SmartRecruiters
- Recruitee
- Teamtailor
- Personio

Les autres systèmes, comme Workday, ne sont pas encore pris en charge, donc la couverture n'est pas complète.

Chaque offre ouverte est une carte. La carte affiche l'entreprise, le lieu, le mode de travail, et le salaire quand l'annonce l'indique. Monfil lit le salaire dans l'annonce quand il est disponible.

Monfil liste toutes les offres de l'entreprise. Pour ne garder que les postes voulus, enregistrez une recherche pour chaque poste. Voir [Emplois](../jobs/).

Une offre reste dans le fil tant que le paramètre de conservation la garde. Monfil ne supprime pas une offre quand l'entreprise pourvoit le poste.

## Substack

Collez l'adresse de la publication, comme `name.substack.com` ou son domaine personnalisé. Monfil trouve le flux. Vous pouvez aussi ajouter `/feed` à la fin de l'adresse vous-même.

## Google Alerts

1. Ouvrez [Google Alerts](https://www.google.com/alerts) et créez une alerte.
2. Sélectionnez **Afficher les options**. Réglez **Distribuer à** sur **Flux RSS**.
3. Sélectionnez **Créer une alerte**. Copiez le lien RSS depuis la liste des alertes et collez-le dans Monfil.

## Sources qui ne fonctionnent pas

X ne publie pas de flux. Reddit arrête ses flux RSS, donc Monfil ne le prend pas en charge.
