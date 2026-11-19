---
title: Anwendungsfälle
description: Drei Beispiel-Setups, um in Ihrem Fachgebiet vorne zu bleiben, von einem DevOps-Ingenieur, einem Gründer und einer Forscherin.
---

Diese drei Personen müssen in ihrem Fachgebiet vorne bleiben. Ein DevOps-Ingenieur muss als Erster wissen, wenn sich ein Werkzeug im Stack ändert. Ein Gründer muss sehen, was Wettbewerber ausliefern und welche Trends wachsen. Eine Forscherin muss die neuen Paper lesen, bevor alle sie zitieren. Jede Person legt einen Workspace an, fügt ein paar Links unter **Feed hinzufügen** ein und liest alles in einem Stream. Kopieren Sie ein Setup und passen Sie es an Ihr Fachgebiet an.

Um eine Quelle hinzuzufügen, wählen Sie **+** oben in der Feed-Seitenleiste und fügen Sie den Link ein. Monfil findet den Feed. Die Seite [Unterstützte Quellen](../supported-sources/) zeigt, was Sie für jede Quelle einfügen können.

## Ein DevOps-Ingenieur

Sam leitet das Plattformteam eines mittelgroßen Unternehmens. Sie muss wissen, wenn ein Werkzeug im Stack ein Release ausliefert, und sie muss sehen, worüber die Community in dieser Woche spricht. Sie möchte nicht jeden Morgen zehn Websites prüfen.

Sam legt einen Workspace namens **Plattform** mit diesen Quellen an:

| Ordner | Einfügen | Das bekommt sie |
| --- | --- | --- |
| Releases | `github.com/kubernetes/kubernetes` | Jedes Kubernetes-Release mit seinen Release Notes |
| Releases | `github.com/opentofu/opentofu` | Jedes OpenTofu-Release |
| Releases | `github.com/argoproj/argo-cd` | Jedes Argo-CD-Release |
| Blogs | `kubernetes.io/blog` | Beiträge aus dem Kubernetes-Blog |
| Blogs | `cncf.io/feed` | Beiträge aus dem CNCF-Blog |
| Community | `hachyderm.io/tags/kubernetes` | Mastodon-Beiträge mit dem Tag `#kubernetes` |
| Community | `fosstodon.org/tags/devops` | Mastodon-Beiträge mit dem Tag `#devops` |
| Community | `@user@hachyderm.io` für jeden Ingenieur, dem Sam vertraut | Die Beiträge dieser Person |

Sam hat kein Mastodon-Konto. Monfil liest die öffentlichen Feeds der Tags und der Personen, daher braucht sie keines.

Release Notes kommen als vollständige Einträge an. Sam liest, was sich geändert hat, ohne GitHub zu öffnen. Wenn ein Minor-Release eine Breaking Change enthält, speichert Sam den Eintrag und verlinkt ihn im Upgrade-Ticket.

**Tipp:** Das Feedpack Platform Engineering enthält bereits Releases für Kubernetes, OpenTofu, Helm und andere Werkzeuge. Installieren Sie es und fügen Sie dann Ihre eigenen Werkzeuge hinzu.

## Ein Gründer

Alex baut allein ein Open-Source-Produkt für Web-Analysen. Er muss sehen, was Wettbewerber ausliefern, und er muss Trends früh erkennen. Er hat wenig Zeit, daher kommen nur starke Signale in den Workspace.

Alex legt einen Workspace namens **Markt** mit diesen Quellen an:

| Ordner | Einfügen | Das bekommt er |
| --- | --- | --- |
| Wettbewerber | `github.com/plausible/analytics` | Jedes Plausible-Release |
| Wettbewerber | `github.com/umami-software/umami` | Jedes Umami-Release |
| Wettbewerber | Der Blog jedes Wettbewerbers | Ihre Launch-Beiträge und Ankündigungen |
| Trends | `news.ycombinator.com`, dann **300+ Punkte** wählen | Nur die Beiträge, die 300 Punkte erreichen |
| Trends | `news.ycombinator.com`, dann **Show HN** wählen | Was andere Entwickler launchen |
| Erwähnungen | Ein Google-Alerts-Feed für den Produktnamen | Neue Seiten, die das Produkt nennen |
| Personen | `@name.bsky.social` für Gründer im selben Bereich | Ihre Beiträge auf Bluesky |

Hacker News bietet eine Auswahl an Feeds. Alex wählt eine Punktgrenze, damit der Stream die Beiträge zeigt, über die die meisten Menschen gesprochen haben, und nicht den gesamten Strom. Für Google Alerts zeigt die Seite [Unterstützte Quellen](../supported-sources/#google-alerts), wie Sie den Feed erhalten.

Ein Release eines Wettbewerbers, das ein Feature aus Alex' Roadmap ausliefert, kommt am selben Tag an. Er braucht kein Bluesky-Konto, um den Gründern zu folgen.

**Tipp:** Das Feedpack Gründer und Solo-Unternehmer enthält bereits die Feeds **Show HN** und **300+ Punkte**. Installieren Sie es und fügen Sie dann Ihre Wettbewerber hinzu.

## Eine Forscherin

Priya arbeitet an Sprachmodellen in einem Universitätslabor. Sie muss jeden Tag die neuen Paper in einigen Kategorien lesen. Außerdem möchte sie wissen, wenn sich eine Bibliothek ändert, die das Labor nutzt, und was andere Forschende zu neuen Papern sagen.

Priya legt einen Workspace namens **Forschung** mit diesen Quellen an:

| Ordner | Einfügen | Das bekommt sie |
| --- | --- | --- |
| Preprints | `arxiv.org/list/cs.CL/recent` | Neue Paper in Computation and Language |
| Preprints | `arxiv.org/list/cs.LG/recent` | Neue Paper in Machine Learning |
| Bibliotheken | `github.com/huggingface/transformers` | Jedes Transformers-Release |
| Bibliotheken | `github.com/pytorch/pytorch` | Jedes PyTorch-Release |
| Labore | `huggingface.co/blog` | Beiträge aus dem Blog von Hugging Face |
| Personen | Das Bluesky-Profil jeder Forscherin, der Priya folgt | Ihre Beiträge und Paper-Threads |

Monfil blendet die arXiv-Ankündigungen für ersetzte Paper aus. So kommt eine neue Version eines alten Papers nicht erneut an. arXiv veröffentlicht am Wochenende nichts. Der Stream ist deshalb am Samstag und Sonntag ruhig.

Priya nutzt die Suche, um alle Paper zu einem Thema über die Kategorien hinweg zu finden. Sie speichert die Paper zum späteren Lesen in der Liste **Gespeichert**.

**Tipp:** Das KI-Feedpack enthält bereits die Kategorien `cs.AI`, `cs.LG` und `cs.CL` sowie Releases wichtiger KI-Bibliotheken.

## Personen ohne Konto folgen

Bluesky und Mastodon veröffentlichen für jedes öffentliche Profil einen Feed. Mastodon veröffentlicht außerdem einen Feed für jeden Tag auf einem Server. Monfil liest diese Feeds direkt:

- Sie brauchen auf keinem der beiden Netzwerke ein Konto, keine App und keine Anmeldung.
- Beiträge kommen zusammen mit den anderen Quellen in Ihrem Stream an. Es gibt keine Empfehlungen und keine Like-Zahlen.
- Monfil liest nur öffentliche Beiträge. Es kann keine Beiträge anzeigen, die eine Anmeldung brauchen, etwa Beiträge nur für Follower.

Um einer Person zu folgen, fügen Sie ihren Profillink oder ihr Handle ein. Verwenden Sie `@name.bsky.social` für Bluesky und `@user@server` für Mastodon und drücken Sie dann die **Eingabetaste**.
