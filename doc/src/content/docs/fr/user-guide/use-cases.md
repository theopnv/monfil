---
title: Cas d'usage
description: Trois exemples de configuration pour rester en avance dans son domaine, avec un ingénieur DevOps, un fondateur et un chercheur.
---

Ces trois personnes doivent rester en avance dans leur domaine. Un ingénieur DevOps doit savoir en premier quand un outil de sa pile change. Un fondateur doit voir ce que lancent ses concurrents et quelles tendances progressent. Un chercheur doit lire les nouveaux articles avant que tout le monde les cite. Chacun crée un workspace, colle quelques liens dans **Ajouter un flux**, et lit tout dans un seul fil. Copiez une configuration, puis modifiez-la pour votre domaine.

Pour ajouter une source, sélectionnez **+** en haut de la barre latérale des flux et collez le lien. Monfil trouve le flux. La page [sources prises en charge](../supported-sources/) liste ce que vous pouvez coller pour chaque source.

## Un ingénieur DevOps

Sam dirige l'équipe plateforme d'une entreprise de taille moyenne. Elle doit savoir quand un outil de sa pile publie une version, et voir ce dont la communauté parle cette semaine. Elle ne veut pas consulter dix sites chaque matin.

Sam crée un workspace nommé **Platform** avec ces sources :

| Dossier | Coller | Ce que cela donne |
| --- | --- | --- |
| Versions | `github.com/kubernetes/kubernetes` | Chaque version de Kubernetes, avec ses notes de version |
| Versions | `github.com/opentofu/opentofu` | Chaque version d'OpenTofu |
| Versions | `github.com/argoproj/argo-cd` | Chaque version d'Argo CD |
| Blogs | `kubernetes.io/blog` | Les articles du blog Kubernetes |
| Blogs | `cncf.io/feed` | Les articles du blog CNCF |
| Communauté | `hachyderm.io/tags/kubernetes` | Les publications Mastodon avec l'étiquette `#kubernetes` |
| Communauté | `fosstodon.org/tags/devops` | Les publications Mastodon avec l'étiquette `#devops` |
| Communauté | `@user@hachyderm.io` pour chaque ingénieur en qui Sam a confiance | Les publications de cette personne |

Sam n'a pas de compte Mastodon. Monfil lit les flux publics des étiquettes et des personnes, donc elle n'en a pas besoin.

Les notes de version arrivent comme des éléments complets, donc Sam lit ce qui a changé sans ouvrir GitHub. Quand une version mineure contient un changement incompatible, Sam enregistre l'élément et le lie dans le ticket de mise à niveau.

**Astuce :** le feedpack Platform Engineering contient déjà les versions de Kubernetes, OpenTofu, Helm et d'autres outils. Installez-le, puis ajoutez vos propres outils.

## Un fondateur

Alex crée seul un produit open source d'analyse web. Il doit voir ce que lancent ses concurrents et repérer les tendances tôt. Il a peu de temps, donc seuls les signaux forts entrent dans le workspace.

Alex crée un workspace nommé **Market** avec ces sources :

| Dossier | Coller | Ce que cela donne |
| --- | --- | --- |
| Concurrents | `github.com/plausible/analytics` | Chaque version de Plausible |
| Concurrents | `github.com/umami-software/umami` | Chaque version d'Umami |
| Concurrents | Le blog de chaque concurrent | Leurs annonces de lancement et leurs communications |
| Tendances | `news.ycombinator.com`, puis choisir **300+ points** | Seulement les articles qui atteignent 300 points |
| Tendances | `news.ycombinator.com`, puis choisir **Show HN** | Ce que lancent les autres créateurs |
| Mentions | Un flux Google Alerts pour le nom du produit | Les nouvelles pages qui citent le produit |
| Personnes | `@name.bsky.social` pour les fondateurs du même domaine | Leurs publications sur Bluesky |

Hacker News propose plusieurs flux. Alex choisit un seuil de points, pour que le fil affiche les articles dont le plus de gens ont parlé, et non le flux complet. Pour Google Alerts, la page [sources prises en charge](../supported-sources/#google-alerts) montre comment obtenir le flux.

Une version d'un concurrent qui livre une fonctionnalité de la feuille de route d'Alex arrive le jour même. Il n'a pas besoin de compte Bluesky pour suivre les fondateurs.

**Astuce :** le feedpack Founders & Solopreneurs contient déjà les flux **Show HN** et **300+ points**. Installez-le, puis ajoutez vos concurrents.

## Un chercheur

Priya travaille sur les modèles de langage dans un laboratoire universitaire. Elle doit lire chaque jour les nouveaux articles de quelques catégories. Elle veut aussi savoir quand une bibliothèque utilisée par le laboratoire change, et ce que disent d'autres chercheurs des nouveaux articles.

Priya crée un workspace nommé **Research** avec ces sources :

| Dossier | Coller | Ce que cela donne |
| --- | --- | --- |
| Publications | `arxiv.org/list/cs.CL/recent` | Les nouveaux articles en Computation and Language |
| Publications | `arxiv.org/list/cs.LG/recent` | Les nouveaux articles en Machine Learning |
| Bibliothèques | `github.com/huggingface/transformers` | Chaque version de Transformers |
| Bibliothèques | `github.com/pytorch/pytorch` | Chaque version de PyTorch |
| Laboratoires | `huggingface.co/blog` | Les articles du blog Hugging Face |
| Personnes | Le profil Bluesky de chaque chercheur que Priya suit | Leurs publications et leurs fils sur les articles |

Monfil masque les annonces arXiv des articles remplacés, donc une nouvelle version d'un ancien article n'arrive pas à nouveau. arXiv ne publie pas le week-end, donc le fil est calme le samedi et le dimanche.

Priya utilise la recherche pour trouver tous les articles sur un sujet dans les catégories. Elle enregistre les articles à lire plus tard dans la liste **Enregistrés**.

**Astuce :** le feedpack IA contient déjà les catégories `cs.AI`, `cs.LG` et `cs.CL`, ainsi que les versions des principales bibliothèques d'IA.

## Suivre des personnes sans compte

Bluesky et Mastodon publient un flux pour chaque profil public. Mastodon publie aussi un flux pour chaque étiquette sur un serveur. Monfil lit directement ces flux :

- Vous n'avez besoin d'aucun compte, d'aucune application ni d'aucune connexion sur l'un ou l'autre réseau.
- Les publications arrivent avec les autres sources de votre fil. Il n'y a pas de recommandations ni de nombres de j'aime.
- Monfil ne lit que les publications publiques. Il ne peut pas afficher les publications qui exigent une connexion, comme les publications réservées aux abonnés.

Pour suivre une personne, collez son lien de profil ou son identifiant. Utilisez `@name.bsky.social` pour Bluesky et `@user@server` pour Mastodon, puis appuyez sur Entrée.
