---
title: Monfil installieren
description: Monfil unter macOS, Windows oder Linux herunterladen und installieren.
---

Monfil ist kostenlos. Wählen Sie Ihr System:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

Sie benötigen macOS 13 Ventura oder neuer. Um zu sehen, welchen Chip Ihr Mac hat, öffnen Sie das Apple-Menü und wählen Sie **Über diesen Mac**. Schauen Sie auf die Zeile **Chip** oder **Prozessor**.

1. Laden Sie die Datei für Ihren Chip aus der neuesten Version herunter:
   - Apple Silicon (die Zeile beginnt mit **Apple**): [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel (die Zeile beginnt mit **Intel**): [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. Öffnen Sie die heruntergeladene Datei. Ein Fenster mit dem Monfil-Symbol und einem Ordner Programme erscheint.
3. Ziehen Sie das Monfil-Symbol auf den Ordner Programme.
4. Schließen Sie das Fenster und werfen Sie das Monfil-Laufwerk in der Seitenleiste des Finders aus.
5. Öffnen Sie Monfil aus Ihrem Ordner Programme oder aus dem Launchpad.

Apple hat diese Version von Monfil geprüft. Deshalb öffnet macOS sie ohne Sicherheitswarnung.

Monfil aktualisiert sich selbst. Wenn eine neue Version bereit ist, erscheint eine Meldung mit der Schaltfläche **Neu starten**. Wählen Sie **Neu starten**, um die Aktualisierung abzuschließen. Aktualisierungen funktionieren nur, wenn Sie Monfil aus dem Ordner Programme öffnen.

## Windows

Monfil funktioniert unter Windows 10 und Windows 11.

### Microsoft Store (empfohlen)

1. Öffnen Sie [Monfil im Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. Wählen Sie **Abrufen** oder **Installieren**.
3. Öffnen Sie Monfil aus dem Startmenü.

Der Store hält Monfil auf dem neuesten Stand.

Sie können die Store-Version auch über ein Terminal mit winget installieren:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### Setup-Datei

Verwenden Sie diese Option, wenn Sie den Microsoft Store nicht nutzen können.

1. Öffnen Sie die [neueste Monfil-Version](https://github.com/theopnv/monfil/releases/latest).
2. Laden Sie unter **Assets** die Datei herunter, die auf `Setup.exe` endet.
3. Öffnen Sie die heruntergeladene Datei. Monfil wird installiert und geöffnet.

Windows zeigt möglicherweise **Der Computer wurde durch Windows geschützt**, weil diese Datei keine kostenpflichtige Signatur hat. Wählen Sie **Weitere Informationen** und dann **Trotzdem ausführen**. Die Store-Version zeigt diese Meldung nicht.

Monfil aktualisiert sich selbst. Wenn eine neue Version bereit ist, erscheint eine Meldung mit der Schaltfläche **Neu starten**. Wählen Sie **Neu starten**, um die Aktualisierung abzuschließen.

## Linux

Monfil funktioniert auf 64-Bit-Computern mit Intel- und AMD-Prozessoren.

1. Öffnen Sie die [neueste Monfil-Version](https://github.com/theopnv/monfil/releases/latest).
2. Laden Sie unter **Assets** die Datei für Ihr System herunter:
    - Unter Debian, Ubuntu oder Linux Mint die Datei, die auf `.deb` endet.
    - Unter Fedora, RHEL oder openSUSE die Datei, die auf `.rpm` endet.
3. Öffnen Sie die heruntergeladene Datei mit Ihrem Software-Center oder installieren Sie sie über ein Terminal in Ihrem Ordner Downloads:
    - Unter Debian, Ubuntu oder Linux Mint: `sudo apt install ./monfil_*.deb`
    - Unter Fedora oder RHEL: `sudo dnf install ./monfil-*.rpm`
4. Öffnen Sie Monfil aus Ihrem Anwendungsmenü.

Monfil aktualisiert sich unter Linux nicht selbst. Um zu aktualisieren, laden Sie die neue Datei aus der neuesten Version herunter und installieren Sie sie.

## Ist Monfil sicher?

Der Quellcode von Monfil ist öffentlich und jeder kann ihn lesen. GitHub erstellt jede Version aus diesem Code mit einem [öffentlichen Workflow](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## Nächster Schritt

Folgen Sie [Monfil verwenden](../home/), um Feeds hinzuzufügen und einen Workspace einzurichten.
