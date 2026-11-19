---
title: Informativa sulla privacy
description: Come il sito di Monfil e l'app desktop gestiscono i dati.
---

:::note
Questa traduzione è una bozza automatica. In caso di differenze, il testo inglese è il riferimento. Leggi la [versione inglese](../../../user-guide/privacy/).
:::

Ultimo aggiornamento: 23 ottobre 2026.

## Sito della documentazione

Questo sito usa [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) per misurare le visite e le prestazioni di caricamento delle pagine. I manutentori di Monfil usano queste statistiche per migliorare la documentazione e trovare le pagine lente.

I report di analisi includono i percorsi delle pagine, i siti di provenienza, il paese, il browser, il sistema operativo, il tipo di dispositivo e i tempi di caricamento. Il tuo browser carica uno script da Cloudflare e invia misurazioni a Cloudflare. Cloudflare riceve il tuo indirizzo IP quando il browser esegue queste richieste. I suoi report di analisi non danno ai manutentori il tuo indirizzo IP.

Cloudflare dichiara che Web Analytics non usa cookie né archiviazione locale per raccogliere le metriche di utilizzo, e non identifica i visitatori con il fingerprinting. Non traccia i visitatori tra siti diversi. Consulta la sua [documentazione sulla raccolta dei dati](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/) per i dettagli.

Cloudflare conserva i dati di analisi non campionati per sette giorni, poi usa dati campionati per le statistiche a lungo termine. La dashboard dà accesso ai sei mesi precedenti. Consulta le [FAQ di Web Analytics](https://developers.cloudflare.com/web-analytics/faq/) per il campionamento e i periodi di accesso ai report.

Cloudflare, Inc. ha sede negli Stati Uniti. La sua [informativa sulla privacy](https://www.cloudflare.com/privacypolicy/) spiega come gestisce i dati delle richieste, per quanto tempo conserva i dati personali e le garanzie che usa per i trasferimenti al di fuori dello Spazio economico europeo.

### Hosting del sito e archiviazione del browser

Cloudflare ospita questo sito. Cloudflare riceve il tuo indirizzo IP e i dettagli della richiesta quando apri una pagina. Consulta l'[informativa sulla privacy di Cloudflare](https://www.cloudflare.com/privacypolicy/).

Il sito salva il tema colore che hai scelto nell'archiviazione locale del tuo browser. Questa impostazione resta sul tuo dispositivo finché non la cambi o non cancelli i dati memorizzati del sito. È separata dall'analisi di Cloudflare.

Puoi bloccare lo script di Cloudflare con il browser o con un blocco dei contenuti, e continuare a leggere la documentazione.

### Domande sulla privacy e diritti

Il responsabile del sito di Monfil è responsabile di questo sito. Per domande sulla privacy o richieste sui tuoi dati personali, scrivi a [hello@monfil.app](mailto:hello@monfil.app).

## App desktop

Monfil è un lettore di feed desktop. Non ha un account e non ha un server Monfil. Conserva i tuoi feed, gli articoli salvati e lo stato di lettura sul tuo dispositivo. Alcune impostazioni di visualizzazione usano l'archiviazione locale. Puoi trovare e fare il backup del database in Impostazioni.

### Statistiche anonime sull'uso (facoltative)

Monfil può inviare statistiche anonime sull'uso. Sono disattivate finché non le accetti. Dopo che hai aggiunto un feed e aperto l'app due volte, Monfil mostra una scheda con due pulsanti di pari importanza, **Condividi statistiche** e **No, grazie**. Se chiudi la scheda, Monfil chiede di nuovo più tardi, al massimo un'altra volta dopo 14 giorni. Puoi cambiare la tua scelta in qualsiasi momento in **Impostazioni > Privacy**. **Vedi cosa viene inviato** mostra il riepilogo che Monfil invierebbe oggi.

Se accetti, Monfil conta sul tuo dispositivo che cosa fai. Una volta al giorno invia un evento `daily_summary` per ogni giorno in cui hai usato l'app. Quando accetti, invia anche un evento `consent_granted` senza dati. L'evento `daily_summary` contiene:

- Conteggi del giorno: articoli aperti, estrazioni del testo completo, feed aggiunti, feed rimossi, aggiornamenti manuali, elementi salvati, feedpack installati, file OPML importati, file OPML esportati, backup eseguiti, workspace creati, workspace cambiati, ricerche ed embed caricati.
- Conteggi degli errori del giorno: errori di aggiornamento dei feed, errori di estrazione degli articoli, errori delle richieste interne ed errori dell'interfaccia. Sono solo numeri. Non contengono testo di errore.
- Lo stato della tua raccolta: un intervallo di dimensione per i tuoi feed (`0`, `1-5`, `6-20`, `21-100` oppure `100+`), il numero di workspace, il numero di cartelle e i tipi di feed che usi, come `rss+youtube`.
- Le tue impostazioni di visualizzazione: densità, tema, lingua dell'interfaccia di Monfil, se gli elementi letti sono nascosti, se gli elementi vengono segnati come letti durante lo scorrimento, se i link si aprono nel browser e se la navigazione da tastiera è attiva.
- Il giorno a cui si riferisce, la versione di Monfil, il sistema operativo e la sua versione, l'impostazione della lingua e la versione del motore web di Monfil.

L'evento non contiene mai il nome di un feed, un link, il testo di un articolo, il testo di una ricerca o un tuo nome. Monfil non invia nessun identificatore duraturo. Ogni richiesta usa un nuovo ID di sessione casuale.

[Aptabase](https://aptabase.com) riceve gli eventi. Technov Solutions SRL, un'azienda con sede a Bucarest, in Romania, gestisce Aptabase. Agisce come responsabile del trattamento per il manutentore di Monfil secondo il suo [accordo sul trattamento dei dati](https://aptabase.com/legal/dpa). Monfil usa la regione UE (`eu.aptabase.com`). Aptabase dichiara che tratta e conserva i dati degli account nella regione UE solo all'interno dell'Unione europea.

Aptabase ricava sul proprio server un ID utente anonimo, come hash del tuo indirizzo IP e dello user agent con un sale. Aptabase dichiara che il sale è diverso per ogni app e viene eliminato ogni 24 ore. L'ID cambia ogni giorno, quindi il manutentore non può seguire una persona da un giorno all'altro. Aptabase dichiara che conserva i dati di analisi fino a 5 anni. Consulta l'[informativa sulla privacy di Aptabase](https://aptabase.com/legal/privacy) per i dettagli.

La base giuridica è il tuo consenso. La tua scelta viene salvata sul tuo dispositivo con la sua data e la versione di questa informativa. Per ritirare il consenso, disattiva **Condividi statistiche anonime sull'uso** nelle Impostazioni. Monfil smette quindi di contare, smette di inviare ed elimina i conteggi che ha conservato sul tuo dispositivo. Gli eventi già ricevuti non possono essere ricondotti a te. Per chiedere informazioni sui tuoi dati, scrivi a [hello@monfil.app](mailto:hello@monfil.app). Una build di Monfil senza chiave di analisi, come una build che compili tu stesso, non invia nulla.

### Richieste ad altri siti

Monfil richiede i feed ai loro editori quando li aggiorna. Aprire un articolo può far richiedere a Monfil la pagina dell'editore per ottenere il testo completo. Le immagini e le icone dei feed possono caricarsi da siti remoti quando compaiono sullo schermo. Quei siti ricevono la richiesta e possono vedere informazioni come il tuo indirizzo IP e i dettagli dell'app o del browser.

Quando aggiungi un feed, Monfil può richiedere la pagina che hai incollato e gli indirizzi comuni dei feed dello stesso sito. Per un link di Hacker News, controlla i feed su [hnrss.org](https://hnrss.org). Per mostrare un'icona per un progetto GitLab o un profilo Bluesky, chiede l'avatar all'API di GitLab o all'API pubblica di Bluesky. Un feed di conferenze richiede l'elenco degli eventi a [developers.events](https://developers.events) quando lo aggiungi e a ogni aggiornamento. Questo elenco è ospitato da GitHub Pages.

Aprire un articolo o un altro link nel browser collega anche al sito linkato. Quel browser usa le sue impostazioni di privacy.

### Contenuti multimediali incorporati

Monfil supporta gli embed di YouTube, X, Vimeo, Instagram e Spotify. Mostra prima una scheda. Monfil crea il riquadro dell'embed del provider solo dopo che fai clic su **Carica** su quella scheda. Ogni embed richiede un clic ogni volta che apri l'articolo. Puoi leggere l'articolo senza caricare l'embed.

Quando carichi un embed, il tuo dispositivo si collega al suo provider. Il provider riceve una richiesta per quel video, quel post o quell'elemento audio. Può vedere il tuo indirizzo IP e i dettagli dell'app o del browser. Può usare cookie o altra archiviazione nel suo riquadro. Monfil non controlla le pratiche sui dati del provider. Il link **Apri su** si collega al provider nel tuo browser se lo selezioni.

Caricare un embed non impedisce alle immagini o alle icone dell'articolo di caricarsi dai loro siti.

Informative sulla privacy dei provider: [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/) e [Spotify](https://www.spotify.com/legal/privacy-policy/).
