---
title: Casi d'uso
description: Tre esempi di configurazione per restare avanti nel proprio settore, da parte di un DevOps engineer, di un fondatore e di una ricercatrice.
---

Queste tre persone devono restare avanti nel loro settore. Un DevOps engineer deve sapere per primo quando cambia uno strumento del proprio stack. Un fondatore deve vedere che cosa lanciano i concorrenti e quali tendenze crescono. Una ricercatrice deve leggere i nuovi articoli prima che tutti li citino. Ciascuna crea un workspace, incolla alcuni link in **Aggiungi un feed** e legge tutto in un unico flusso. Copia una configurazione, poi modificala per il tuo settore.

Per aggiungere una fonte, seleziona **+** in alto nella sidebar dei feed e incolla il link. Monfil trova il feed. La pagina [fonti supportate](../supported-sources/) elenca che cosa puoi incollare per ogni fonte.

## Un DevOps engineer

Sam guida il team di piattaforma in un'azienda di medie dimensioni. Deve sapere quando uno strumento dello stack pubblica una release, e deve vedere che cosa discute la community in questa settimana. Non vuole controllare dieci siti ogni mattina.

Sam crea un workspace chiamato **Piattaforma** con queste fonti:

| Cartella | Incolla | Che cosa ottiene |
| --- | --- | --- |
| Release | `github.com/kubernetes/kubernetes` | Ogni release di Kubernetes, con le sue note di rilascio |
| Release | `github.com/opentofu/opentofu` | Ogni release di OpenTofu |
| Release | `github.com/argoproj/argo-cd` | Ogni release di Argo CD |
| Blog | `kubernetes.io/blog` | Articoli dal blog di Kubernetes |
| Blog | `cncf.io/feed` | Articoli dal blog della CNCF |
| Community | `hachyderm.io/tags/kubernetes` | Post Mastodon con il tag `#kubernetes` |
| Community | `fosstodon.org/tags/devops` | Post Mastodon con il tag `#devops` |
| Community | `@user@hachyderm.io` per ogni ingegnere di cui Sam si fida | I post di quella persona |

Sam non ha un account Mastodon. Monfil legge i feed pubblici dei tag e delle persone, quindi lei non ne ha bisogno.

Le note di rilascio arrivano come elementi completi, quindi Sam legge che cosa è cambiato senza aprire GitHub. Quando una release minore contiene una modifica che rompe la compatibilità, Sam salva l'elemento e lo collega al ticket di aggiornamento.

**Suggerimento:** il feedpack Platform Engineering contiene già le release di Kubernetes, OpenTofu, Helm e altri strumenti. Installalo, poi aggiungi i tuoi strumenti.

## Un fondatore

Alex costruisce da solo un prodotto open source di analisi web. Deve vedere che cosa lanciano i concorrenti, e deve individuare le tendenze in anticipo. Ha poco tempo, quindi nel workspace entrano solo segnali forti.

Alex crea un workspace chiamato **Mercato** con queste fonti:

| Cartella | Incolla | Che cosa ottiene |
| --- | --- | --- |
| Concorrenti | `github.com/plausible/analytics` | Ogni release di Plausible |
| Concorrenti | `github.com/umami-software/umami` | Ogni release di Umami |
| Concorrenti | Il blog di ogni concorrente | I loro post di lancio e gli annunci |
| Tendenze | `news.ycombinator.com`, poi scegli **300+ punti** | Solo le storie che raggiungono 300 punti |
| Tendenze | `news.ycombinator.com`, poi scegli **Show HN** | Che cosa lanciano gli altri creatori |
| Menzioni | Un feed Google Alerts per il nome del prodotto | Nuove pagine che citano il prodotto |
| Persone | `@name.bsky.social` per i fondatori dello stesso settore | I loro post su Bluesky |

Hacker News offre una scelta di feed. Alex sceglie una soglia di punteggio, così il flusso mostra le storie di cui parla la maggior parte delle persone e non il flusso completo. Per Google Alerts, la pagina [fonti supportate](../supported-sources/#google-alerts) mostra come ottenere il feed.

Una release di un concorrente che introduce una funzione presente nella roadmap di Alex arriva nello stesso giorno. Alex non ha bisogno di un account Bluesky per seguire i fondatori.

**Suggerimento:** il feedpack Fondatori e solopreneur contiene già i feed **Show HN** e **300+ punti**. Installalo, poi aggiungi i tuoi concorrenti.

## Una ricercatrice

Priya lavora sui modelli linguistici in un laboratorio universitario. Deve leggere ogni giorno i nuovi articoli di alcune categorie. Vuole anche sapere quando cambia una libreria usata dal laboratorio, e che cosa dicono altri ricercatori sui nuovi articoli.

Priya crea un workspace chiamato **Ricerca** con queste fonti:

| Cartella | Incolla | Che cosa ottiene |
| --- | --- | --- |
| Articoli | `arxiv.org/list/cs.CL/recent` | Nuovi articoli in Computation and Language |
| Articoli | `arxiv.org/list/cs.LG/recent` | Nuovi articoli in Machine Learning |
| Librerie | `github.com/huggingface/transformers` | Ogni release di Transformers |
| Librerie | `github.com/pytorch/pytorch` | Ogni release di PyTorch |
| Laboratori | `huggingface.co/blog` | Articoli dal blog di Hugging Face |
| Persone | Il profilo Bluesky di ogni ricercatore che Priya segue | I loro post e le discussioni sugli articoli |

Monfil nasconde gli annunci arXiv per gli articoli sostituiti, così una nuova versione di un vecchio articolo non torna nel flusso. arXiv non pubblica nel fine settimana, quindi il flusso è tranquillo il sabato e la domenica.

Priya usa la ricerca per trovare tutti gli articoli su un argomento in tutte le categorie. Priya salva gli articoli da leggere più tardi nell'elenco **Salvati**.

**Suggerimento:** il feedpack IA contiene già le categorie `cs.AI`, `cs.LG` e `cs.CL` e le release delle librerie IA più importanti.

## Segui persone senza account

Bluesky e Mastodon pubblicano un feed per ogni profilo pubblico. Mastodon pubblica anche un feed per ogni tag su un server. Monfil legge direttamente questi feed:

- Non ti servono un account, un'app o un accesso su nessuna delle due reti.
- I post arrivano insieme alle altre fonti nel tuo flusso. Non ci sono consigli né conteggi di mi piace.
- Monfil legge solo i post pubblici. Non può mostrare post che richiedono l'accesso, come i post visibili solo ai follower.

Per seguire una persona, incolla il link del suo profilo o il suo nome utente. Usa `@name.bsky.social` per Bluesky e `@user@server` per Mastodon, poi premi Invio.
