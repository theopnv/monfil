---
title: Fonti supportate
description: Che cosa puoi incollare in Aggiungi un feed, e che cosa segue Monfil per ogni fonte.
---

Seleziona **+** in alto nella sidebar dei feed per aprire **Aggiungi un feed**. Incolla un link nella casella. Monfil trova il feed collegato al link. Non ti serve l'URL del feed.

I chip sotto la casella impostano il tipo di fonte. Lascia **Tutto** per far riconoscere a Monfil il tipo dal link. Scegli un chip quando Monfil non riesce a riconoscerlo, oppure quando scrivi una forma breve come un nome utente. Per un nome utente, premi Invio per avviare la verifica.

Alcuni link portano a più di un feed. In quel caso Monfil mostra un elenco e seleziona il primo feed. Seleziona quello che vuoi, poi seleziona **Continua**.

## Siti web e blog

Incolla l'indirizzo di una pagina qualsiasi del sito. Monfil legge i link ai feed che la pagina dichiara. Se la pagina non ne ha, Monfil prova gli indirizzi comuni dei feed dello stesso sito, come `/feed` e `/rss.xml`.

## GitHub

| Incolla | Monfil segue |
| --- | --- |
| Un repository, come `github.com/microsoft/playwright` | Le release del repository |
| Un utente o un'organizzazione, come `github.com/torvalds` | L'attività pubblica |
| `owner/repo`, con il chip **GitHub** | Le release del repository |

## GitLab

Incolla il link di un progetto, come `gitlab.com/gitlab-org/gitlab`. Monfil segue le release del progetto. Per un GitLab self-hosted, scegli prima il chip **GitLab**.

## Hacker News

Incolla `news.ycombinator.com`. Monfil offre questi feed:

- **Prima pagina**, da Hacker News stesso. È il predefinito.
- **100+ punti** e **300+ punti**, con solo le storie che raggiungono quel punteggio.
- **Show HN** e **Ask HN**.

Gli ultimi quattro arrivano da [hnrss.org](https://hnrss.org), un servizio gratuito che non fa parte di Hacker News. Un link a una sezione, come `news.ycombinator.com/show`, dà solo quella sezione.

## arXiv

Incolla un elenco di categoria, come `arxiv.org/list/cs.AI/recent`. Monfil segue gli annunci giornalieri per quella categoria. Nasconde gli articoli sostituiti, perché sono nuove versioni di articoli che hai già visto. arXiv non pubblica nel fine settimana.

## Bluesky e Mastodon senza account

Non ti serve un account Bluesky o Mastodon per seguire persone su quelle reti. Entrambe le reti pubblicano un feed per ogni profilo pubblico, e Monfil lo legge. Consulta [Casi d'uso](../use-cases/#segui-persone-senza-account).

## Bluesky

Incolla il link di un profilo, come `bsky.app/profile/bsky.app`, oppure un nome utente, come `@name.bsky.social`. Per un nome utente su un dominio personalizzato senza `@`, scegli il chip **Bluesky**.

## Mastodon

Incolla un nome utente, come `@user@mastodon.social`. Puoi anche incollare il link di un profilo o di un tag di qualsiasi server, come `hachyderm.io/@user` oppure `hachyderm.io/tags/rust`.

## YouTube

Incolla il link di un canale, di un nome utente, di un video o di una playlist. Un link a un video segue il canale che lo ha pubblicato.

## Conferenze per sviluppatori

Scegli il chip **Conferenze**. Scrivi gli argomenti, poi `in`, poi i luoghi, e premi Invio. Separa le voci di ogni elenco con virgole. I luoghi sono facoltativi. Usa `online` per gli eventi online.

| Tipo | Monfil segue |
| --- | --- |
| `devops` | Conferenze DevOps in tutti i luoghi |
| `kubernetes, cloud in France` | Conferenze su Kubernetes o cloud in Francia |
| `java in Belgium, online` | Conferenze su Java in Belgio o online |

Un argomento corrisponde a un tag di conferenza, come `java` o `devops`. Monfil sostituisce gli spazi di un argomento con trattini, quindi `software testing` trova il tag `software-testing`. Un luogo corrisponde a una città o a un paese.

Puoi anche incollare un link di [developers.events](https://developers.events) senza il chip. Prima imposta i filtri sul sito, poi copia l'indirizzo. Monfil usa i filtri di paese, argomento, tecnologia e lingua. Ignora l'anno nell'indirizzo e mostra le conferenze di tutti gli anni. Se il link ha un altro filtro, come la regione, Monfil ti chiede di rimuoverlo.

Se nessuna conferenza usa un argomento o un luogo, Monfil te lo dice e suggerisce corrispondenze vicine. Per esempio, `test automation` suggerisce `testing`. Se argomento e luogo sono corretti ma nessuna conferenza corrisponde al momento, Monfil te lo dice. Puoi comunque aggiungere il feed. Mostrerà una scheda quando viene annunciata una conferenza corrispondente.

Monfil aggiunge una scheda al flusso quando si verifica uno di questi eventi:

- Una conferenza inizia nei prossimi 12 mesi.
- Si apre la sua call for papers (CFP).
- La sua CFP si chiude entro 14 giorni.
- Inizia tra 30 giorni.
- Inizia oggi.

Quando aggiungi il feed, ottieni una scheda per ogni evento che si è già verificato. Monfil legge i dati da developers.events a ogni aggiornamento. Non conserva una copia dell'elenco completo. I dati hanno la licenza [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), e ogni scheda indica la sua fonte.

## Offerte di lavoro

Scegli il chip **Offerte di lavoro**. Incolla la bacheca di lavoro di un'azienda, come `jobs.lever.co/spotify` oppure `boards.greenhouse.io/datadog`. Puoi anche incollare la pagina carriere dell'azienda. Monfil cerca nella pagina un link a una bacheca di lavoro supportata (potrebbe non funzionare sempre).

Monfil legge le bacheche pubbliche di questi sistemi:

- Greenhouse
- Lever
- Ashby
- Workable
- SmartRecruiters
- Recruitee
- Teamtailor
- Personio

Altri sistemi, come Workday, non sono ancora supportati, quindi la copertura non è completa.

Ogni offerta aperta è una scheda. La scheda mostra l'azienda, il luogo, la modalità di lavoro e lo stipendio quando l'annuncio lo indica. Monfil legge lo stipendio dall'annuncio quando è disponibile.

Monfil elenca tutte le offerte dell'azienda. Per mantenere solo i ruoli che ti interessano, salva una ricerca per ogni ruolo. Consulta [Offerte di lavoro](../jobs/).

Un'offerta resta nel flusso finché la impostazione di conservazione la mantiene. Monfil non rimuove un'offerta quando l'azienda la chiude.

## Substack

Incolla l'indirizzo della pubblicazione, come `name.substack.com` oppure il suo dominio personalizzato. Monfil trova il feed. Puoi anche aggiungere tu stesso `/feed` alla fine dell'indirizzo.

## Google Alerts

1. Apri [Google Alerts](https://www.google.com/alerts) e crea un avviso.
2. Seleziona **Mostra opzioni**. Imposta **Invia a** su **Feed RSS**.
3. Seleziona **Crea avviso**. Copia il link RSS dall'elenco degli avvisi e incollalo in Monfil.

## Fonti che non funzionano

X non pubblica feed. Reddit sta eliminando i suoi feed RSS, quindi Monfil non lo supporta.
