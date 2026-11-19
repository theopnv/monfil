---
title: Avis de confidentialité
description: Comment le site Monfil et l'application de bureau traitent les données.
---

:::note
Cette traduction est une ébauche produite par machine. En cas de différence, le texte anglais fait foi. Consultez la [version anglaise](../../../user-guide/privacy/).
:::

Dernière mise à jour : 23 octobre 2026.

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

Monfil est un lecteur de flux de bureau. Il n'a ni compte ni serveur Monfil. Il enregistre vos flux, vos articles enregistrés et leur état de lecture sur votre appareil. Certains réglages d'affichage utilisent le stockage local. Vous pouvez trouver et sauvegarder la base de données dans les **Paramètres**.

### Statistiques d'usage anonymes (facultatif)

Monfil peut envoyer des statistiques d'usage anonymes. Elles sont désactivées tant que vous n'avez pas accepté. Après avoir ajouté un flux et ouvert l'application deux fois, Monfil affiche une carte avec deux boutons de même taille, **Partager les statistiques** et **Non merci**. Si vous fermez la carte, elle revient plus tard, au plus une fois de plus après 14 jours. Vous pouvez modifier votre choix à tout moment dans **Paramètres > Confidentialité**. **Voir ce qui est envoyé** affiche le résumé que Monfil enverrait aujourd'hui.

Si vous acceptez, Monfil compte sur votre appareil ce que vous faites. Une fois par jour, il envoie un événement `daily_summary` pour chaque jour où vous avez utilisé l'application. Quand vous acceptez, il envoie aussi un événement `consent_granted` sans données. L'événement `daily_summary` contient :

- Des compteurs pour la journée : articles ouverts, extractions de texte intégral, flux ajoutés, flux supprimés, actualisations manuelles, éléments enregistrés, feedpacks installés, fichiers OPML importés, fichiers OPML exportés, sauvegardes effectuées, workspaces créés, workspaces changés, recherches et contenus intégrés chargés.
- Des compteurs d'échecs pour la journée : échecs d'actualisation des flux, échecs d'extraction d'articles, échecs de requêtes internes et échecs de l'interface. Ce sont seulement des nombres. Ils ne contiennent aucun texte d'erreur.
- L'état de votre bibliothèque : une tranche de taille pour vos flux (`0`, `1-5`, `6-20`, `21-100` ou `100+`), le nombre de workspaces, le nombre de dossiers, et les types de flux que vous utilisez, comme `rss+youtube`.
- Vos réglages d'affichage : densité, thème, langue de l'interface Monfil, masquage des éléments lus, marquage comme lu au défilement, ouverture des liens dans votre navigateur, et navigation au clavier activée ou non.
- Le jour concerné, la version de Monfil, votre système d'exploitation et sa version, votre langue, et la version du moteur web de Monfil.

L'événement ne contient jamais le nom d'un flux, un lien, le texte d'un article, un texte de recherche ni votre nom. Monfil n'envoie aucun identifiant durable. Chaque requête utilise un nouvel identifiant de session aléatoire.

[Aptabase](https://aptabase.com) reçoit les événements. Technov Solutions SRL, une entreprise basée à Bucarest, en Roumanie, exploite Aptabase. Elle agit comme sous-traitant pour le mainteneur de Monfil, selon son [accord de traitement des données](https://aptabase.com/legal/dpa). Monfil utilise la région UE (`eu.aptabase.com`). Aptabase indique qu'il traite et stocke les données des comptes de la région UE uniquement dans l'Union européenne.

Aptabase calcule sur son serveur un identifiant utilisateur anonyme, sous forme de hachage de votre adresse IP et de votre user agent avec un sel. Aptabase indique que le sel est différent pour chaque application et qu'il est supprimé toutes les 24 heures. L'identifiant change chaque jour, donc le mainteneur ne peut pas suivre une personne d'un jour à l'autre. Aptabase indique qu'il conserve les données d'analyse jusqu'à 5 ans. Voir la [politique de confidentialité d'Aptabase](https://aptabase.com/legal/privacy) pour plus de détails.

La base légale est votre consentement. Votre choix est enregistré sur votre appareil avec sa date et la version de cet avis. Pour le retirer, désactivez **Partager des statistiques d'utilisation anonymes** dans les **Paramètres**. Monfil cesse alors de compter, cesse d'envoyer, et supprime les compteurs qu'il a conservés sur votre appareil. Les événements déjà reçus ne peuvent pas être reliés à vous. Pour poser une question sur vos données, écrivez à [hello@monfil.app](mailto:hello@monfil.app). Une version de Monfil sans clé d'analyse, comme une version que vous compilez vous-même, n'envoie rien.

### Requêtes vers d'autres sites

Monfil demande les flux à leurs éditeurs quand il les actualise. Ouvrir un article peut amener Monfil à demander la page de l'éditeur pour en obtenir le texte intégral. Les images et les icônes de flux peuvent se charger depuis des sites distants quand elles apparaissent à l'écran. Ces sites reçoivent la requête et peuvent voir des informations comme votre adresse IP et les détails de l'application ou du navigateur.

Quand vous ajoutez un flux, Monfil peut demander la page que vous avez collée et les adresses de flux courantes du même site. Pour un lien Hacker News, il vérifie les flux sur [hnrss.org](https://hnrss.org). Pour afficher une icône de projet GitLab ou de profil Bluesky, il demande l'avatar à l'API GitLab ou à l'API publique de Bluesky. Un flux de conférences demande la liste des événements à [developers.events](https://developers.events) quand vous l'ajoutez et à chaque actualisation. GitHub Pages héberge cette liste.

Ouvrir un article ou un autre lien dans votre navigateur se connecte aussi au site lié. Ce navigateur utilise ses propres réglages de confidentialité.

### Contenus intégrés

Monfil prend en charge les contenus intégrés de YouTube, X, Vimeo, Instagram et Spotify. Il affiche d'abord une carte. Monfil crée le cadre intégré du fournisseur seulement après que vous avez cliqué sur **Charger** sur cette carte. Chaque contenu intégré demande un clic à chaque fois que vous ouvrez l'article. Vous pouvez lire l'article sans charger le contenu intégré.

Quand vous chargez un contenu intégré, votre appareil se connecte à son fournisseur. Le fournisseur reçoit une requête pour cette vidéo, cette publication ou cet audio. Il peut voir votre adresse IP et les détails de votre application ou de votre navigateur. Il peut utiliser des cookies ou un autre stockage dans son cadre. Monfil ne contrôle pas les pratiques de données du fournisseur. Le lien **Ouvrir sur** se connecte au fournisseur dans votre navigateur si vous cliquez dessus.

Charger un contenu intégré n'empêche pas les images et les icônes de flux de l'article de se charger depuis leurs propres sites.

Politiques de confidentialité des fournisseurs : [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/), et [Spotify](https://www.spotify.com/legal/privacy-policy/).
