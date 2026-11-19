---
title: Suche und gespeicherte Suchen
description: Den Stream mit Wortgruppen, OR, Ausschlüssen und Titeln durchsuchen und eine Suche als Pill über dem Stream behalten.
---

Das Suchfeld über dem Stream filtert die Einträge des aktuellen Workspaces. Es funktioniert für jede Quelle gleich.

## Suchsyntax

| Eingabe | Monfil zeigt |
| --- | --- |
| `rust async` | Einträge, die beide Wörter enthalten |
| `"machine learning"` | Einträge, die die genaue Wortgruppe enthalten |
| `kubernetes OR k8s` | Einträge, die eines der Wörter enthalten. Schreiben Sie `OR` in Großbuchstaben. |
| `-sponsored` | Einträge ohne das Wort. Funktioniert auch für eine Wortgruppe: `-"press release"`. |
| `title:release` | Einträge mit dem Wort im Titel. Funktioniert auch für eine Wortgruppe: `title:"release notes"`. |

Sie können die Formen kombinieren: `title:"release notes" -beta`. Eine Kette wie `go OR rust OR zig` funktioniert. Klammern funktionieren nicht, und ein Wort mit `-` kann nicht Teil eines `OR` sein. Ein Bindestrich innerhalb eines Wortes, etwa in `front-end`, gehört zum Wort.

Ein Wort mit drei Buchstaben oder weniger, etwa `ci`, findet nur ganze Wörter, also nicht `producing`. Jedes andere Wort findet auch Teile längerer Wörter, daher findet `engineer` auch `engineers`. Setzen Sie ein kurzes Wort in Anführungszeichen, etwa `"ci"`, um es auch innerhalb von Wörtern zu finden.

Ohne `title:` sucht Monfil im Titel, in den ersten 200 Zeichen des Textes und im Feednamen. Bei einer Stelle sucht es außerdem im Ort und in der Arbeitsform. Den vollständigen Text eines Eintrags durchsucht es nicht.

## Gespeicherte Suche speichern

1. Geben Sie eine Suche ein. Neben dem Suchfeld erscheint eine Schaltfläche **Suche speichern**.
2. Wählen Sie **Suche speichern**, geben Sie einen Namen ein und drücken Sie die **Eingabetaste**.

Die Suche ist jetzt ein Pill über dem Stream. Die Zahl auf dem Pill ist die Anzahl der ungelesenen Einträge, die passen. Die Pills gehören zu dem Workspace, in dem Sie sie angelegt haben.

- Wählen Sie einen Pill, um seine Suche auszuführen. Wählen Sie ihn erneut, um die Suche aufzuheben.
- Ein Pill zeigt gelesene und ungelesene Einträge. Dadurch bleibt ein Eintrag auch an den Tagen nach dem Lesen in seiner Suche. Wählen Sie **Ungelesen**, um die gelesenen Einträge wieder auszublenden.
- Zeigen Sie auf einen Pill und wählen Sie das Kreuz, um ihn zu löschen.
- Klicken Sie mit der rechten Maustaste auf einen Pill oder markieren Sie ihn und drücken Sie F2, um ihn umzubenennen.
- Wenn Sie die Suche eines ausgewählten Pills ändern, ändert **Aktualisieren** den Pill. **Als neue speichern** legt einen zweiten Pill an.
- Gibt es mehr Pills, als die Zeile anzeigen kann, scrollen Sie die Zeile seitwärts oder wählen Sie das Menü mit den drei Punkten, um alle zu sehen.
