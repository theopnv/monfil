---
title: Datenschutzhinweis
description: Wie die Monfil-Website und die Desktop-App mit Daten umgehen.
---

:::note
Diese Übersetzung ist ein maschineller Entwurf. Bei Abweichungen gilt der [englische Text](../../../user-guide/privacy/) als Referenz.
:::

Zuletzt aktualisiert: 23. Oktober 2026.

## Dokumentationswebsite

Diese Website nutzt [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), um Besuche und die Ladezeit der Seiten zu messen. Die Betreuer von Monfil nutzen diese Statistiken, um die Dokumentation zu verbessern und langsame Seiten zu finden.

Die Analyseberichte enthalten Seitenpfade, verweisende Websites, Land, Browser, Betriebssystem, Gerätetyp und Ladezeiten. Ihr Browser lädt ein Skript von Cloudflare und sendet Messwerte an Cloudflare. Cloudflare erhält Ihre IP-Adresse, wenn Ihr Browser diese Anfragen stellt. Die Analyseberichte geben den Betreuern nicht Ihre IP-Adresse preis.

Cloudflare erklärt, dass Web Analytics keine Cookies und keinen lokalen Speicher nutzt, um Nutzungsdaten zu erfassen, und dass keine Identifizierung per Fingerprinting erfolgt. Die Besucher werden nicht über verschiedene Websites hinweg verfolgt. Details finden Sie in der [Dokumentation zur Datenerfassung](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/).

Cloudflare speichert ungesampelte Analysedaten sieben Tage lang. Danach nutzt es gesampelte Daten für längerfristige Statistiken. Das Dashboard bietet Zugriff auf die vorangegangenen sechs Monate. Die Angaben zu Sampling und Zugriffszeiträumen finden Sie in den [FAQ zu Web Analytics](https://developers.cloudflare.com/web-analytics/faq/).

Cloudflare, Inc. hat seinen Sitz in den Vereinigten Staaten. Die [Datenschutzerklärung](https://www.cloudflare.com/privacypolicy/) beschreibt, wie das Unternehmen Anfragedaten verarbeitet, wie lange es personenbezogene Daten speichert und welche Schutzmaßnahmen es für Übermittlungen außerhalb des Europäischen Wirtschaftsraums anwendet.

### Hosting der Website und Speicher im Browser

Cloudflare hostet diese Website. Cloudflare erhält Ihre IP-Adresse und Anfragedetails, wenn Sie eine Seite öffnen. Siehe die [Datenschutzerklärung von Cloudflare](https://www.cloudflare.com/privacypolicy/).

Die Website speichert Ihr gewähltes Farbdesign im lokalen Speicher Ihres Browsers. Diese Einstellung bleibt auf Ihrem Gerät, bis Sie sie ändern oder die gespeicherten Daten der Website löschen. Sie ist von den Analysen von Cloudflare getrennt.

Sie können das Skript von Cloudflare mit Ihrem Browser oder einem Inhaltsblocker blockieren und die Dokumentation trotzdem lesen.

### Datenschutzfragen und Rechte

Der Betreuer der Monfil-Website ist für diese Website verantwortlich. Bei Datenschutzfragen oder Anfragen zu Ihren personenbezogenen Daten schreiben Sie an [hello@monfil.app](mailto:hello@monfil.app).

## Desktop-App

Monfil ist ein Feed-Reader für den Desktop. Er hat kein Konto und keinen Monfil-Server. Monfil speichert Ihre Feeds, gespeicherten Artikel und den Lesestatus auf Ihrem Gerät. Einige Anzeigeeinstellungen nutzen lokalen Speicher. Die Datenbank finden und sichern Sie unter Einstellungen.

### Anonyme Nutzungsstatistiken (optional)

Monfil kann anonyme Nutzungsstatistiken senden. Sie sind ausgeschaltet, bis Sie zustimmen. Nachdem Sie einen Feed hinzugefügt und die App zweimal geöffnet haben, zeigt Monfil eine Karte mit zwei gleich großen Schaltflächen: **Nutzungsstatistiken teilen** und **Nein danke**. Wenn Sie die Karte schließen, fragt Monfil später erneut, höchstens noch einmal nach 14 Tagen. Ihre Wahl können Sie jederzeit unter **Einstellungen > Datenschutz** ändern. Mit **Gesendete Daten ansehen** sehen Sie die Zusammenfassung, die Monfil heute senden würde.

Wenn Sie zustimmen, zählt Monfil auf Ihrem Gerät, was Sie tun. Einmal am Tag sendet es für jeden Tag, an dem Sie die App genutzt haben, ein Ereignis `daily_summary`. Wenn Sie zustimmen, sendet es außerdem ein Ereignis `consent_granted` ohne Daten. Das Ereignis `daily_summary` enthält:

- Zählungen für den Tag: geöffnete Artikel, Extraktionen des Volltexts, hinzugefügte Feeds, entfernte Feeds, manuelle Aktualisierungen, gespeicherte Einträge, installierte Feedpacks, importierte OPML-Dateien, exportierte OPML-Dateien, erstellte Sicherungen, angelegte Workspaces, gewechselte Workspaces, Suchen und geladene Einbettungen.
- Zählungen der Fehler des Tages: Fehler beim Aktualisieren von Feeds, Fehler bei der Extraktion von Artikeln, Fehler bei internen Anfragen und Fehler der Oberfläche. Dies sind nur Zahlen. Sie enthalten keinen Fehlertext.
- Den Stand Ihrer Bibliothek: einen Größenbereich für Ihre Feeds (`0`, `1-5`, `6-20`, `21-100` oder `100+`), die Anzahl der Workspaces, die Anzahl der Ordner und die Arten von Feeds, die Sie nutzen, etwa `rss+youtube`.
- Ihre Anzeigeeinstellungen: Dichte, Design, die Sprache der Monfil-Oberfläche, ob gelesene Einträge ausgeblendet sind, ob Einträge beim Scrollen als gelesen markiert werden, ob Links im Browser geöffnet werden und ob die Tastaturnavigation aktiv ist.
- Den Tag, den das Ereignis betrifft, die Version von Monfil, Ihr Betriebssystem und dessen Version, Ihre Spracheinstellung und die Version der Web-Engine in Monfil.

Das Ereignis enthält nie einen Feednamen, einen Link, Artikeltext, Suchtext oder einen Namen von Ihnen. Monfil sendet keine dauerhafte Kennung. Jede Anfrage nutzt eine neue zufällige Sitzungs-ID.

[Aptabase](https://aptabase.com) empfängt die Ereignisse. Technov Solutions SRL, ein Unternehmen mit Sitz in Bukarest, Rumänien, betreibt Aptabase. Es handelt als Auftragsverarbeiter für den Betreuer von Monfil gemäß dessen [Auftragsverarbeitungsvertrag](https://aptabase.com/legal/dpa). Monfil nutzt die EU-Region (`eu.aptabase.com`). Aptabase erklärt, dass es die Daten von Konten in der EU-Region nur innerhalb der Europäischen Union verarbeitet und speichert.

Aptabase leitet auf seinem Server eine anonyme Nutzer-ID ab. Sie ist ein Hash aus Ihrer IP-Adresse und Ihrem User-Agent mit einem Salt. Aptabase erklärt, dass der Salt für jede App verschieden ist und alle 24 Stunden verworfen wird. Die ID ändert sich jeden Tag, daher kann der Betreuer eine Person nicht von einem Tag zum nächsten verfolgen. Aptabase erklärt, dass es Analysedaten bis zu 5 Jahre speichert. Details finden Sie in der [Datenschutzerklärung von Aptabase](https://aptabase.com/legal/privacy).

Rechtsgrundlage ist Ihre Einwilligung. Ihre Wahl wird auf Ihrem Gerät gespeichert, zusammen mit ihrem Datum und der Version dieses Hinweises. Zum Widerruf schalten Sie **Anonyme Nutzungsstatistiken teilen** in den Einstellungen aus. Monfil zählt dann nicht mehr, sendet nichts mehr und löscht die Zählungen, die es auf Ihrem Gerät gespeichert hat. Bereits empfangene Ereignisse lassen sich nicht mehr Ihnen zuordnen. Um Fragen zu Ihren Daten zu stellen, schreiben Sie an [hello@monfil.app](mailto:hello@monfil.app). Eine Version von Monfil ohne Analyse-Schlüssel, etwa eine Version, die Sie selbst kompilieren, sendet nichts.

### Anfragen an andere Websites

Monfil fordert Feeds bei ihren Herausgebern an, wenn es sie aktualisiert. Das Öffnen eines Artikels kann dazu führen, dass Monfil die Seite des Herausgebers anfordert, um den Volltext zu erhalten. Bilder und Feed-Symbole können von fremden Websites geladen werden, sobald sie auf dem Bildschirm erscheinen. Diese Websites erhalten die Anfrage und können Angaben wie Ihre IP-Adresse sowie App- oder Browserdetails sehen.

Wenn Sie einen Feed hinzufügen, kann Monfil die eingefügte Seite und übliche Feed-Adressen auf derselben Website anfordern. Bei einem Hacker-News-Link prüft es Feeds auf [hnrss.org](https://hnrss.org). Um ein Symbol für ein GitLab-Projekt oder ein Bluesky-Profil anzuzeigen, fragt es die GitLab-API oder die öffentliche Bluesky-API nach dem Avatar. Ein Konferenz-Feed fordert die Ereignisliste von [developers.events](https://developers.events) an, wenn Sie ihn hinzufügen, und bei jeder Aktualisierung. Die Liste wird auf GitHub Pages gehostet.

Wenn Sie einen Artikel oder einen anderen Link im Browser öffnen, verbindet sich dieser auch mit der verlinkten Website. Dieser Browser nutzt seine eigenen Datenschutzeinstellungen.

### Eingebettete Medien

Monfil unterstützt Einbettungen von YouTube, X, Vimeo, Instagram und Spotify. Zuerst zeigt es eine Karte. Den eingebetteten Rahmen des Anbieters erstellt Monfil erst, nachdem Sie auf dieser Karte **Laden** klicken. Jede Einbettung braucht bei jedem Öffnen des Artikels einen eigenen Klick. Sie können den Artikel lesen, ohne die Einbettung zu laden.

Wenn Sie eine Einbettung laden, verbindet sich Ihr Gerät mit dem Anbieter. Der Anbieter erhält eine Anfrage für dieses Video, diesen Beitrag oder dieses Audio. Er kann Ihre IP-Adresse sowie App- oder Browserdetails sehen. Er kann Cookies oder anderen Speicher in seinem Rahmen nutzen. Monfil hat keinen Einfluss auf die Datenschutzpraktiken des Anbieters. Der Link **Bei [Anbieter] öffnen** verbindet Sie im Browser mit dem Anbieter, wenn Sie ihn anklicken.

Das Laden einer Einbettung verhindert nicht, dass Bilder oder Feed-Symbole des Artikels von ihren eigenen Websites geladen werden.

Datenschutzerklärungen der Anbieter: [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/) und [Spotify](https://www.spotify.com/legal/privacy-policy/).
