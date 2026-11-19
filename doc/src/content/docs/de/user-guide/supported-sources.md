---
title: Unterstützte Quellen
description: Was Sie im Fenster Feed hinzufügen einfügen können und was Monfil für jede Quelle verfolgt.
---

Wählen Sie **+** oben in der Feed-Seitenleiste, um **Feed hinzufügen** zu öffnen. Fügen Sie einen Link in das Feld ein. Monfil findet den Feed hinter dem Link. Sie brauchen die Feed-URL selbst nicht.

Die Chips unter dem Feld legen den Quellentyp fest. Lassen Sie **Alles** ausgewählt, damit Monfil den Typ aus dem Link erkennt. Wählen Sie einen Chip, wenn Monfil ihn nicht erkennen kann oder wenn Sie eine Kurzform wie ein Handle eingeben. Bei einem Handle drücken Sie die **Eingabetaste**, um die Prüfung zu starten.

Manche Links führen zu mehr als einem Feed. Dann zeigt Monfil eine Liste und wählt den ersten Feed aus. Wählen Sie den gewünschten Feed und dann **Weiter**.

## Websites und Blogs

Fügen Sie die Adresse einer beliebigen Seite der Website ein. Monfil liest die Feed-Links, die die Seite anbietet. Hat die Seite keine, probiert Monfil übliche Feed-Adressen auf derselben Website aus, etwa `/feed` und `/rss.xml`.

## GitHub

| Einfügen | Monfil folgt |
| --- | --- |
| Ein Repository, etwa `github.com/microsoft/playwright` | Den Releases des Repositorys |
| Einem Benutzer oder einer Organisation, etwa `github.com/torvalds` | Den öffentlichen Aktivitäten |
| `owner/repo` mit dem Chip **GitHub** | Den Releases des Repositorys |

## GitLab

Fügen Sie einen Projektlink ein, etwa `gitlab.com/gitlab-org/gitlab`. Monfil folgt den Releases des Projekts. Bei einem selbst gehosteten GitLab wählen Sie zuerst den Chip **GitLab**.

## Hacker News

Fügen Sie `news.ycombinator.com` ein. Monfil bietet diese Feeds an:

- **Startseite** von Hacker News selbst. Das ist der Standard.
- **100+ Punkte** und **300+ Punkte**, nur mit den Beiträgen, die diese Punktzahl erreichen.
- **Show HN** und **Ask HN**.

Die letzten vier stammen von [hnrss.org](https://hnrss.org), einem kostenlosen Dienst, der nicht zu Hacker News gehört. Ein Link zu einem Bereich, etwa `news.ycombinator.com/show`, liefert nur diesen Bereich.

## arXiv

Fügen Sie eine Kategorieliste ein, etwa `arxiv.org/list/cs.AI/recent`. Monfil folgt den täglichen Ankündigungen für diese Kategorie. Es blendet ersetzte Arbeiten aus, weil sie neue Versionen von Arbeiten sind, die Sie schon gesehen haben. arXiv veröffentlicht am Wochenende nichts.

## Bluesky und Mastodon ohne Konto

Sie brauchen kein Bluesky- oder Mastodon-Konto, um dort Personen zu folgen. Beide Netzwerke stellen für jedes öffentliche Profil einen Feed bereit, und Monfil liest ihn. Siehe [Anwendungsfälle](../use-cases/#personen-ohne-konto-folgen).

## Bluesky

Fügen Sie einen Profillink ein, etwa `bsky.app/profile/bsky.app`, oder ein Handle, etwa `@name.bsky.social`. Bei einem Handle auf einer eigenen Domain ohne `@` wählen Sie den Chip **Bluesky**.

## Mastodon

Fügen Sie ein Handle ein, etwa `@user@mastodon.social`. Sie können auch einen Profil- oder Tag-Link von jedem Server einfügen, etwa `hachyderm.io/@user` oder `hachyderm.io/tags/rust`.

## YouTube

Fügen Sie einen Kanal-, Handle-, Video- oder Playlist-Link ein. Ein Video-Link folgt dem Kanal, der es veröffentlicht hat.

## Entwicklerkonferenzen

Wählen Sie den Chip **Konferenzen**. Geben Sie Themen ein, dann `in`, dann Orte, und drücken Sie die **Eingabetaste**. Trennen Sie die Einträge jeder Liste mit Kommas. Orte sind optional. Verwenden Sie `online` für Online-Veranstaltungen.

| Eingabe | Monfil folgt |
| --- | --- |
| `devops` | DevOps-Konferenzen an allen Orten |
| `kubernetes, cloud in France` | Kubernetes- oder Cloud-Konferenzen in Frankreich |
| `java in Belgium, online` | Java-Konferenzen in Belgien oder online |

Ein Thema passt zu einem Konferenz-Tag, etwa `java` oder `devops`. Monfil ersetzt Leerzeichen in einem Thema durch Bindestriche. Daher findet `software testing` den Tag `software-testing`. Ein Ort passt zu einer Stadt oder einem Land.

Sie können auch einen Link von [developers.events](https://developers.events) ohne den Chip einfügen. Stellen Sie die Filter zuerst auf der Website ein und kopieren Sie danach die Adresse. Monfil nutzt die Filter für Land, Thema, Technologie und Sprache. Es ignoriert das Jahr in der Adresse und zeigt Konferenzen aller Jahre. Hat der Link einen anderen Filter, etwa eine Region, weist Monfil Sie darauf hin, dass Sie ihn entfernen müssen.

Wenn keine Konferenz ein Thema oder einen Ort verwendet, teilt Monfil das mit und schlägt ähnliche Treffer vor. Zum Beispiel schlägt `test automation` `testing` vor. Wenn Thema und Ort stimmen, aber aktuell keine Konferenz passt, teilt Monfil auch das mit. Sie können den Feed trotzdem hinzufügen. Er zeigt eine Karte, sobald eine passende Konferenz angekündigt wird.

Monfil fügt dem Stream eine Karte hinzu, wenn eines dieser Ereignisse eintritt:

- Eine Konferenz beginnt in den nächsten 12 Monaten.
- Ihr Call for Papers (CFP) öffnet.
- Ihr CFP schließt in 14 Tagen.
- Sie beginnt in 30 Tagen.
- Sie beginnt heute.

Wenn Sie den Feed hinzufügen, erhalten Sie eine Karte für jedes Ereignis, das bereits eingetreten ist. Monfil liest die Daten von developers.events bei jeder Aktualisierung. Es speichert keine Kopie der vollständigen Liste. Die Daten stehen unter der Lizenz [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), und jede Karte nennt ihre Quelle.

## Stellen

Wählen Sie den Chip **Stellen**. Fügen Sie die Stellenbörse eines Unternehmens ein, etwa `jobs.lever.co/spotify` oder `boards.greenhouse.io/datadog`. Sie können auch die Karriereseite des Unternehmens einfügen. Monfil sucht auf der Seite nach einem Link zu einer unterstützten Stellenbörse (das klappt nicht immer).

Monfil liest die öffentlichen Stellenbörsen dieser Systeme:

- Greenhouse
- Lever
- Ashby
- Workable
- SmartRecruiters
- Recruitee
- Teamtailor
- Personio

Andere Systeme, etwa Workday, werden noch nicht unterstützt. Die Abdeckung ist daher nicht vollständig.

Jede offene Stelle ist eine Karte. Die Karte zeigt das Unternehmen, den Ort, die Arbeitsform und das Gehalt, wenn die Ausschreibung eines angibt. Monfil liest das Gehalt aus der Ausschreibung, wenn es verfügbar ist.

Monfil listet alle Stellen des Unternehmens auf. Um nur die gewünschten Rollen zu behalten, speichern Sie für jede Rolle eine Suche. Siehe [Stellen](../jobs/).

Eine Stelle bleibt so lange im Stream, wie die Einstellung für die Aufbewahrung sie behält. Monfil entfernt eine Stelle nicht, wenn das Unternehmen sie besetzt.

## Substack

Fügen Sie die Adresse der Publikation ein, etwa `name.substack.com` oder deren eigene Domain. Monfil findet den Feed. Sie können auch selbst `/feed` am Ende der Adresse anfügen.

## Google Alerts

1. Öffnen Sie [Google Alerts](https://www.google.com/alerts) und legen Sie eine Benachrichtigung an.
2. Wählen Sie **Optionen anzeigen**. Setzen Sie **Zustellen an** auf **RSS-Feed**.
3. Wählen Sie **Benachrichtigung erstellen**. Kopieren Sie den RSS-Link aus der Liste der Benachrichtigungen und fügen Sie ihn in Monfil ein.

## Quellen, die nicht funktionieren

X veröffentlicht keine Feeds. Reddit stellt seine RSS-Feeds ein, daher unterstützt Monfil Reddit nicht.
