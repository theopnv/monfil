---
title: Avis de confidentialité
description: Comment le site Monfil et l'application de bureau traitent les données.
---

:::note
Cette traduction est une ébauche produite par machine. En cas de différence, le texte anglais fait foi. Consultez la [version anglaise](../../../user-guide/privacy/).
:::

Dernière mise à jour : 23 novembre 2026.

## Site de documentation

Ce site utilise [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) pour mesurer les visites et les temps de chargement des pages. Les mainteneurs de Monfil utilisent ces statistiques pour améliorer la documentation et repérer les pages lentes.

Les rapports d'analyse contiennent les chemins des pages, les sites de provenance, le pays, le navigateur, le système d'exploitation, le type d'appareil et les temps de chargement. Votre navigateur charge un script depuis Cloudflare et envoie des mesures à Cloudflare. Cloudflare reçoit votre adresse IP quand votre navigateur effectue ces requêtes. Ses rapports d'analyse ne donnent pas votre adresse IP aux mainteneurs.

Cloudflare indique que Web Analytics n'utilise aucun cookie ni aucun stockage local pour collecter les mesures d'usage, et n'identifie pas les visiteurs par empreinte numérique. Il ne suit pas les visiteurs d'un site à l'autre. Voir sa [documentation sur la collecte des données](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/) pour plus de détails.

Cloudflare conserve les données d'analyse non échantillonnées pendant sept jours, puis utilise des données échantillonnées pour les statistiques à plus long terme. Le tableau de bord donne accès aux six mois précédents. Voir la [FAQ de Web Analytics](https://developers.cloudflare.com/web-analytics/faq/) pour ses périodes d'échantillonnage et d'accès aux rapports.

Cloudflare, Inc. est basée aux États-Unis. Sa [politique de confidentialité](https://www.cloudflare.com/privacypolicy/) explique comment elle traite les données de requête, combien de temps elle conserve les données personnelles, et les garanties qu'elle utilise pour les transferts hors de l'Espace économique européen.

### Hébergement du site et stockage du navigateur

Cloudflare héberge ce site. Cloudflare reçoit votre adresse IP et les détails de la requête quand vous ouvrez une page. Voir la [politique de confidentialité de Cloudflare](https://www.cloudflare.com/privacypolicy/).

Le site enregistre le thème de couleur que vous choisissez dans le stockage local de votre navigateur. Ce réglage reste sur votre appareil jusqu'à ce que vous le modifiiez ou que vous effaciez les données stockées du site. Il est distinct des analyses de Cloudflare.

Vous pouvez bloquer le script de Cloudflare avec votre navigateur ou un bloqueur de contenu, et continuer à lire la documentation.

### Questions et droits liés à la vie privée

Le mainteneur du site Monfil est responsable de ce site. Pour toute question de confidentialité ou toute demande concernant vos données personnelles, écrivez à [hello@monfil.app](mailto:hello@monfil.app).

## Application de bureau

Monfil est un lecteur de flux RSS qui s'installe sur votre ordinateur. Il n'a ni compte ni serveur Monfil. Il enregistre vos flux, vos articles enregistrés et leur état de lecture sur votre appareil. Certains réglages d'affichage utilisent le stockage local. Vous pouvez trouver et sauvegarder la base de données dans les **Paramètres**.

### Statistiques d'usage anonymes et rapports d'erreur (facultatif)

Monfil peut envoyer des statistiques d'usage anonymes et des rapports d'erreur. Un seul réglage contrôle les deux. Les deux sont désactivés tant que vous n'avez pas accepté. À la première ouverture de Monfil, une carte s'affiche avec deux boutons identiques, **Partager statistiques et rapports** et **Non merci**. Si vous refusez ou fermez la carte, Monfil vous redemande après 30 jours, puis tous les 30 jours tant que vous n'avez pas accepté. Vous pouvez modifier votre choix à tout moment dans **Paramètres > Confidentialité**. **Voir ce qui est envoyé** affiche le résumé que Monfil enverrait aujourd'hui et un exemple de rapport d'erreur.

#### Statistiques d'usage

Si vous acceptez, Monfil compte sur votre appareil ce que vous faites. Une fois par jour, il envoie un événement `daily_summary` pour chaque jour où vous avez utilisé l'application. Quand vous acceptez, il envoie aussi un événement `consent_granted` sans données. L'événement `daily_summary` contient :

- Des compteurs pour la journée : articles ouverts, extractions de texte intégral, flux ajoutés, flux supprimés, actualisations manuelles, éléments enregistrés, feedpacks installés, fichiers OPML importés, fichiers OPML exportés, sauvegardes effectuées, workspaces créés, workspaces changés, recherches et contenus intégrés chargés.
- Des compteurs d'échecs pour la journée : échecs d'actualisation des flux, échecs d'extraction d'articles, échecs de requêtes internes et échecs de l'interface. Ce sont seulement des nombres. Ils ne contiennent aucun texte d'erreur.  Les échecs d'actualisation de flux sont aussi comptés par cause : délai dépassé, HTTP 4xx, HTTP 5xx, TLS, DNS, analyse ou fichier trop volumineux.
- Le démarrage de l'app : si elle a démarré, et dans quelle plage de temps elle a affiché les premiers articles (moins de 1 seconde, 1 à 3 secondes, 3 à 10 secondes ou plus de 10 secondes).
- L'ajout d'un flux : le nombre de tentatives et de réussites, et le nombre d'échecs par cause : aucun flux trouvé, réseau, analyse ou format non pris en charge.
- L'état de votre bibliothèque : une tranche de taille pour vos flux (`0`, `1-5`, `6-20`, `21-100` ou `100+`), le nombre de workspaces, le nombre de dossiers, et les types de flux que vous utilisez, comme `rss+youtube`.
- Vos réglages d'affichage : densité, thème, langue de l'interface Monfil, masquage des éléments lus, marquage comme lu au défilement, ouverture des liens dans votre navigateur, et navigation au clavier activée ou non.
- Le jour concerné, la version de Monfil, votre système d'exploitation et sa version, votre langue, et la version du moteur web de Monfil.

L'événement ne contient jamais le nom d'un flux, un lien, le texte d'un article, un texte de recherche ni votre nom. Monfil n'envoie aucun identifiant durable. Chaque requête utilise un nouvel identifiant de session aléatoire.

[Aptabase](https://aptabase.com) reçoit les événements. Technov Solutions SRL, une entreprise basée à Bucarest, en Roumanie, exploite Aptabase. Elle agit comme sous-traitant pour le mainteneur de Monfil, selon son [accord de traitement des données](https://aptabase.com/legal/dpa). Monfil utilise la région UE (`eu.aptabase.com`). Aptabase indique qu'il traite et stocke les données des comptes de la région UE uniquement dans l'Union européenne.

Aptabase calcule sur son serveur un identifiant utilisateur anonyme, sous forme de hachage de votre adresse IP et de votre user agent avec un sel. Aptabase indique que le sel est différent pour chaque application et qu'il est supprimé toutes les 24 heures. L'identifiant change chaque jour, donc le mainteneur ne peut pas suivre une personne d'un jour à l'autre. Aptabase indique qu'il conserve les données d'analyse jusqu'à 5 ans. Voir la [politique de confidentialité d'Aptabase](https://aptabase.com/legal/privacy) pour plus de détails.

#### Rapports d'erreur

Si vous acceptez, Monfil envoie un rapport quand quelque chose échoue, par exemple une erreur dans l'app, une mise à jour qui échoue, une récupération de la base de données ou un plantage. Un rapport contient :

- Le type de l'erreur, son message et la trace d'appels, qui liste des endroits du code de Monfil.
- Un court identifiant d'incident, le même que celui de l'écran d'erreur, et la partie de l'app qui a échoué, par exemple le nom d'une requête interne.
- Une courte trace des derniers événements de Monfil avant l'échec. Elle contient des noms d'événements et des choix fixes, comme `outcome: failed`. Elle ne contient jamais un nom de flux, un lien ni l'identifiant d'un flux ou d'un article.
- La version de Monfil, la source de la version (GitHub ou une boutique), votre système d'exploitation et sa version, le type de votre processeur, et les versions du moteur web et de Node.js dans Monfil.
- Des données de session qui indiquent combien de sessions se terminent sans plantage : le début de la session, sa durée et si elle s'est bien terminée.

Avant d'envoyer un rapport, Monfil supprime du texte de l'erreur les chemins de fichiers (votre dossier personnel devient `~`), les liens et les adresses e-mail. Il n'envoie que les champs de la liste ci-dessus et écarte le reste. Un rapport ne contient ni nom de flux, ni lien, ni texte d'article, ni texte de recherche, ni nom d'utilisateur, ni adresse IP ajoutée par Monfil. **Voir ce qui est envoyé** affiche un exemple de rapport que Monfil crée sur votre appareil à partir d'une panne fictive.

Si Monfil plante à un niveau bas, il envoie aussi un vidage de plantage. C'est un instantané de la mémoire du processus qui a planté. La mémoire peut contenir des fragments de ce que l'app affichait, comme le titre d'un article. Monfil ne peut pas les supprimer.

Après une panne, vous pouvez ajouter des détails au rapport. Le commentaire est facultatif, et vous l'écrivez. Le fichier journal n'est joint que si vous cochez **Joindre le fichier journal**, et vous pouvez le prévisualiser avant l'envoi. Le fichier journal contient les enregistrements d'événements de Monfil, sans noms de flux, liens complets, texte d'article, identifiants ni chemins de fichiers. Il peut encore montrer des noms d'hôtes de sites et des codes d'erreur. Monfil en joint le dernier mégaoctet. La fenêtre d'erreur native, qui n'a pas de champ de texte, ne propose que le fichier journal.

[Sentry](https://sentry.io) reçoit les rapports. Functional Software, Inc., une entreprise basée aux États-Unis, exploite Sentry. Elle agit comme sous-traitant du mainteneur de Monfil selon son [accord de traitement des données](https://sentry.io/legal/dpa/). Monfil utilise la région UE (`de.sentry.io`), où Sentry stocke les données en Allemagne. Sentry reçoit votre adresse IP à chaque requête, et le projet Monfil est réglé pour ne pas la conserver. Sentry garde les rapports d'erreur pendant 30 jours. Le mainteneur reçoit un e-mail quand un nouveau problème apparaît.

#### Votre choix

La base légale est votre consentement. Votre choix est enregistré sur votre appareil avec sa date et la version de cet avis. Pour le retirer, désactivez **Partager des statistiques d'usage anonymes et des rapports d'erreur** dans les paramètres. Monfil cesse alors de compter et d'envoyer, et supprime les compteurs, les rapports en attente d'envoi et les vidages de plantage conservés sur votre appareil. Les rapports déjà reçus ne peuvent pas être rattachés à vous, sauf si vous communiquez au mainteneur l'identifiant d'incident d'un rapport. Pour toute question sur vos données, écrivez à [hello@monfil.app](mailto:hello@monfil.app). Une version de Monfil sans clé d'analyse et sans adresse de rapport d'erreur, comme une version que vous compilez vous-même, n'envoie rien.

### Requêtes vers d'autres sites

Monfil demande les flux à leurs éditeurs quand il les actualise. Ouvrir un article peut amener Monfil à demander la page de l'éditeur pour en obtenir le texte intégral. Les images et les icônes de flux peuvent se charger depuis des sites distants quand elles apparaissent à l'écran. Ces sites reçoivent la requête et peuvent voir des informations comme votre adresse IP et les détails de l'application ou du navigateur.

Quand vous ajoutez un flux, Monfil peut demander la page que vous avez collée et les adresses de flux courantes du même site. Pour un lien Hacker News, il vérifie les flux sur [hnrss.org](https://hnrss.org). Pour afficher une icône de projet GitLab ou de profil Bluesky, il demande l'avatar à l'API GitLab ou à l'API publique de Bluesky. Un flux de conférences demande la liste des événements à [developers.events](https://developers.events) quand vous l'ajoutez et à chaque actualisation. GitHub Pages héberge cette liste.

Ouvrir un article ou un autre lien dans votre navigateur se connecte aussi au site lié. Ce navigateur utilise ses propres réglages de confidentialité.

### Contenus intégrés

Monfil prend en charge les contenus intégrés de YouTube, X, Vimeo, Instagram et Spotify. Il affiche d'abord une carte. Monfil crée le cadre intégré du fournisseur seulement après que vous avez cliqué sur **Charger** sur cette carte. Chaque contenu intégré demande un clic à chaque fois que vous ouvrez l'article. Vous pouvez lire l'article sans charger le contenu intégré.

Quand vous chargez un contenu intégré, votre appareil se connecte à son fournisseur. Le fournisseur reçoit une requête pour cette vidéo, cette publication ou cet audio. Il peut voir votre adresse IP et les détails de votre application ou de votre navigateur. Il peut utiliser des cookies ou un autre stockage dans son cadre. Monfil ne contrôle pas les pratiques de données du fournisseur. Le lien **Ouvrir sur** se connecte au fournisseur dans votre navigateur si vous cliquez dessus.

Charger un contenu intégré n'empêche pas les images et les icônes de flux de l'article de se charger depuis leurs propres sites.

Politiques de confidentialité des fournisseurs : [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/), et [Spotify](https://www.spotify.com/legal/privacy-policy/).
