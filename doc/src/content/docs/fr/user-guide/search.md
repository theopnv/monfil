---
title: Recherche et recherches enregistrées
description: Recherchez dans le fil avec des expressions, OR, des exclusions et le titre, et gardez une recherche sous forme de pastille au-dessus du fil.
---

La zone de recherche au-dessus du fil filtre les éléments du workspace en cours. Elle fonctionne de la même façon pour toutes les sources.

## Syntaxe de recherche

| Type | Monfil affiche |
| --- | --- |
| `rust async` | Éléments qui contiennent les deux mots |
| `"machine learning"` | Éléments qui contiennent l'expression exacte |
| `kubernetes OR k8s` | Éléments qui contiennent l'un des deux mots. Écrivez `OR` en majuscules. |
| `-sponsored` | Éléments sans ce mot. Fonctionne aussi pour une expression : `-"press release"`. |
| `title:release` | Éléments dont le titre contient le mot. Fonctionne aussi pour une expression : `title:"release notes"`. |

Vous pouvez combiner les formes : `title:"release notes" -beta`. Une chaîne comme `go OR rust OR zig` fonctionne. Les parenthèses ne fonctionnent pas, et un mot précédé de `-` ne peut pas faire partie d'un `OR`. Un trait d'union à l'intérieur d'un mot, comme dans `front-end`, fait partie du mot.

Un mot de trois lettres ou moins, comme `ci`, ne correspond qu'à des mots entiers, donc il ne trouve pas `producing`. Les autres mots correspondent aussi à l'intérieur de mots plus longs, donc `engineer` trouve `engineers`. Mettez un mot court entre guillemets, comme `"ci"`, pour qu'il corresponde aussi à l'intérieur des mots.

Sans `title:`, Monfil cherche dans le titre, dans les 200 premiers caractères du texte et dans le nom du flux. Pour une offre, il cherche aussi dans le lieu et le mode de travail. Il ne cherche pas dans le texte complet d'un élément.

## Enregistrer une recherche

1. Saisissez une recherche. Un bouton **Enregistrer la recherche** apparaît à côté de la zone de recherche.
2. Sélectionnez **Enregistrer la recherche**, saisissez un nom, et appuyez sur Entrée.

La recherche est maintenant une pastille au-dessus du fil. Le nombre sur la pastille est le nombre d'éléments non lus qui correspondent. Les pastilles appartiennent au workspace où vous les avez créées.

- Sélectionnez une pastille pour lancer sa recherche. Sélectionnez-la à nouveau pour effacer la recherche.
- Une pastille affiche les éléments lus et non lus, donc un élément reste dans sa recherche les jours suivant sa lecture. Sélectionnez **Non lus** pour masquer à nouveau les éléments lus.
- Pointez une pastille et sélectionnez la croix pour la supprimer.
- Faites un clic droit sur une pastille, ou placez le focus dessus et appuyez sur F2, pour la renommer.
- Si vous modifiez la recherche d'une pastille sélectionnée, **Mettre à jour** change la pastille. **Enregistrer comme nouvelle** crée une deuxième pastille.
- Quand il y a plus de pastilles que la rangée n'en affiche, faites défiler la rangée latéralement ou sélectionnez le menu à trois points pour toutes les voir.
