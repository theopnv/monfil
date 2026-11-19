---
title: Ein Feedpack einreichen
description: Eine Sammlung von Feeds mit anderen Monfil-Lesern teilen.
---

Ein Feedpack ist eine Sammlung von Feeds zu einem Thema. Sie können eines in Monfil erstellen und für den Feedpack-Katalog vorschlagen. Zum Einreichen brauchen Sie ein GitHub-Konto. Jeden Schritt können Sie aber auf der Website von GitHub ausführen.

Sie reichen eine OPML-Datei mit den Feeds ein und aktualisieren `feedpacks/index.json`, damit das Paket beschrieben ist. Ein Pull Request bittet den Betreuer von Monfil, diese Änderungen zu prüfen. Ihr Paket erscheint im Katalog, nachdem es angenommen wurde.

## 1. Das Paket in Monfil erstellen

1. Wählen Sie **+** in der linken Leiste, um einen Workspace für das Thema anzulegen. Nutzen Sie **+** oben in der Feed-Seitenleiste, um die Feeds hinzuzufügen, die Sie teilen möchten. Ordnen Sie sie in sinnvolle Ordner.
2. Öffnen Sie jeden Feed. Prüfen Sie, ob er regelmäßig Inhalte veröffentlicht und zum Thema passt. Entfernen Sie Dubletten und defekte Feeds.
3. Klicken Sie mit der rechten Maustaste auf das Workspace-Symbol in der linken Leiste und wählen Sie **Als OPML exportieren**.
4. Speichern Sie die Datei unter einem kurzen Namen aus Kleinbuchstaben, die mit Bindestrichen verbunden sind, etwa `web-performance.opml`.

OPML ist das Dateiformat, mit dem Monfil eine Liste von Feeds und Ordnern zwischen Apps überträgt. Der Export speichert die Feeds dieses Workspaces.

## 2. Eine Kopie des Projekts auf GitHub anlegen

1. [Legen Sie ein GitHub-Konto an](https://github.com/signup), falls Sie noch keines haben. Melden Sie sich an und öffnen Sie das [Monfil-Repository](https://github.com/theopnv/monfil).
2. Wählen Sie **Fork** und dann **Fork erstellen**. GitHub legt eine Kopie unter Ihrem Konto an. Der [Leitfaden zu Forks von GitHub](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) zeigt Bilder dieser Schaltflächen.
3. Öffnen Sie in Ihrem Fork das Branch-Menü über der Dateiliste. Es zeigt zuerst **main**. Geben Sie einen Namen ein, etwa `add-web-performance-pack`, und wählen Sie dann **Branch erstellen**. Ein Branch enthält die Änderungen, die Sie einreichen möchten. Lassen Sie ihn für beide Dateiänderungen ausgewählt.

## 3. Die OPML-Datei hochladen

1. Öffnen Sie in Ihrem Fork den Ordner `feedpacks`.
2. Wählen Sie **Datei hinzufügen** und dann **Dateien hochladen**. Wählen Sie die OPML-Datei, die Sie exportiert haben.
3. Speichern Sie die Änderung auf dem Branch, den Sie angelegt haben. GitHub beschriftet die Schaltfläche möglicherweise mit **Änderungen committen** oder **Änderungen vorschlagen**. Ein Commit speichert eine Änderung in Ihrer Kopie.

## 4. Das Paket im Katalog beschreiben

1. Bleiben Sie in Ihrem Fork und auf demselben Branch. Öffnen Sie `feedpacks/index.json` und wählen Sie das Stiftsymbol, um die Datei zu bearbeiten.
2. Fügen Sie ein Objekt in die Liste `packs` ein. Setzen Sie ein Komma zwischen Ihr Objekt und das davor. Nutzen Sie dieses Beispiel als Vorlage:

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

Ersetzen Sie die Beispielwerte durch Ihre eigenen. Der Wert `slug` muss unter den vorhandenen Paketen eindeutig sein. Der Wert `opml` muss Ihrem Dateinamen genau entsprechen. `sourceCount` ist die Anzahl der Feeds ohne die Ordner. Setzen Sie `updatedAt` auf das Datum, an dem Sie die Quellen zuletzt geprüft haben, im Format `YYYY-MM-DD`. Verwenden Sie eine kurze Beschreibung und einige Suchbegriffe in Kleinbuchstaben. Lassen Sie den Wert `version` im Stammverzeichnis unverändert.

Speichern Sie diese Änderung auf demselben Branch wie die OPML-Datei.

## 5. Um eine Prüfung bitten

1. Kehren Sie zum [ursprünglichen Monfil-Repository](https://github.com/theopnv/monfil) zurück. Wählen Sie **Pull Requests** und dann **Neuer Pull Request**.
2. Wählen Sie **Forks übergreifend vergleichen**. Setzen Sie das Basis-Repository auf `theopnv/monfil` und den Basisbranch auf `main`. Setzen Sie **Head-Fork** auf Ihre Kopie und **Vergleichsbranch** auf den Branch, den Sie angelegt haben. Der [Leitfaden zu Pull Requests von Forks bei GitHub](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) zeigt diese Ansicht.
3. Prüfen Sie **Geänderte Dateien**. Dort sollten Ihre OPML-Datei und Ihre Änderung an `feedpacks/index.json` stehen.
4. Geben Sie der Anfrage einen klaren Titel. Beschreiben Sie in der Beschreibung, was das Paket abdeckt, wie Sie die Feeds ausgewählt haben und ob eine Quelle Kontext braucht. Wählen Sie **Pull Request erstellen**.

GitHub führt eine Prüfung durch, ob die OPML-Datei existiert und ob `sourceCount` zu ihren Feeds passt. Der Betreuer prüft die Quellen, ihre Passung zum Thema und die Angaben im Katalog. Sie können Fragen im Pull Request beantworten und denselben Branch aktualisieren, falls Änderungen nötig sind.

Bevor das Paket angenommen werden kann, müssen Sie die [Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md) unterzeichnen. CLA Assistant fügt Ihrem Pull Request einen Link hinzu. Folgen Sie diesem Link, um zu unterzeichnen.

## Wenn Sie die OPML-Datei selbst erstellen

Verwenden Sie OPML 2.0. Legen Sie jeden Ordner in ein `<outline>` und jeden Feed in einen Ordner. Jeder Feed braucht einen Titel, einen unterstützten `type` und eine `xmlUrl`. Sie können ein [vorhandenes Feedpack](https://github.com/theopnv/monfil/tree/main/feedpacks) als Beispiel nutzen.

Wenn Sie lokal am Projekt arbeiten, führen Sie `npm install` und danach `npm run check:feedpacks` aus, bevor Sie einreichen. Dieser Befehl prüft die Dateinamen und Quellenanzahlen im Katalog. Öffnen Sie die Feeds selbst, um zu prüfen, ob ihre URLs funktionieren und ob der Inhalt zu Ihrem Paket passt.
