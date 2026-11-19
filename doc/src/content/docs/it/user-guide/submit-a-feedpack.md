---
title: Invia un feedpack
description: Condividi una raccolta di feed con altri lettori di Monfil.
---

Un feedpack è una raccolta di feed su un argomento. Puoi crearne uno in Monfil e proporlo per il catalogo dei feedpack. Ti serve un account GitHub per inviarlo, ma puoi usare il sito di GitHub per ogni passo.

Invierai un file OPML con i feed e aggiornerai `feedpacks/index.json` per descrivere il pacchetto. Una pull request chiede al manutentore di Monfil di esaminare queste modifiche. Il tuo pacchetto compare nel catalogo dopo che viene accettato.

## 1. Crea il pacchetto in Monfil

1. Seleziona **+** nella barra a sinistra per creare un workspace per l'argomento. Usa **+** in alto nella sidebar dei feed per aggiungere i feed che vuoi condividere. Mettili in cartelle utili.
2. Apri ogni feed. Controlla che pubblichi contenuti e che sia adatto all'argomento. Rimuovi i duplicati e i feed non funzionanti.
3. Fai clic destro sull'icona del workspace nella barra a sinistra e seleziona **Esporta come OPML**.
4. Salva il file con un nome breve, fatto di parole minuscole unite da trattini, come `web-performance.opml`.

OPML è il formato di file che Monfil usa per spostare un elenco di feed e cartelle tra app. L'esportazione salva i feed di quel workspace.

## 2. Crea una copia del progetto su GitHub

1. [Crea un account GitHub](https://github.com/signup) se non ne hai uno. Accedi e apri il [repository di Monfil](https://github.com/theopnv/monfil).
2. Seleziona **Fork**, poi **Crea fork**. GitHub crea una copia sotto il tuo account. La [guida ai fork di GitHub](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) mostra con immagini questi pulsanti.
3. Nel tuo fork, apri il menu dei branch sopra l'elenco dei file. All'inizio mostra **main**. Scrivi un nome, per esempio `add-web-performance-pack`, poi seleziona **Crea branch**. Un branch contiene le modifiche che vuoi inviare. Lascialo selezionato per entrambe le modifiche ai file.

## 3. Carica il file OPML

1. Nel tuo fork, apri la cartella `feedpacks`.
2. Seleziona **Aggiungi file**, poi **Carica file**. Scegli il file OPML che hai esportato.
3. Salva la modifica sul branch che hai creato. GitHub può etichettare il pulsante come **Esegui commit delle modifiche** o **Proponi modifiche**. Un commit salva una modifica nella tua copia.

## 4. Descrivi il pacchetto nel catalogo

1. Resta nel tuo fork e sullo stesso branch. Apri `feedpacks/index.json`, poi seleziona l'icona a forma di matita per modificarlo.
2. Aggiungi un oggetto dentro la lista `packs`. Metti una virgola tra il tuo oggetto e quello precedente. Usa questo esempio come guida:

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

Sostituisci i valori di esempio con i tuoi. Assicurati che `slug` sia unico tra i pacchetti esistenti, e che `opml` corrisponda esattamente al nome del file. `sourceCount` è il numero di feed, senza le cartelle. Imposta `updatedAt` alla data in cui hai controllato l'ultima volta le fonti, nel formato `YYYY-MM-DD`. Usa una descrizione breve e alcuni tag di ricerca in minuscolo. Lascia invariato il valore `version` della radice.

Salva questa modifica sullo stesso branch del file OPML.

## 5. Chiedi una revisione

1. Torna al [repository originale di Monfil](https://github.com/theopnv/monfil). Seleziona **Pull request**, poi **Nuova pull request**.
2. Seleziona **confronta tra fork**. Imposta il repository di base su `theopnv/monfil` e il branch di base su `main`. Imposta il **fork head** sulla tua copia e il **branch di confronto** sul branch che hai creato. [La guida alle pull request da fork di GitHub](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) mostra questa schermata.
3. Controlla **File modificati**. Deve mostrare il tuo file OPML e la tua modifica a `feedpacks/index.json`.
4. Dai alla richiesta un titolo chiaro. Nella descrizione, spiega che cosa copre il pacchetto, come hai scelto i feed e se una fonte richiede un contesto. Seleziona **Crea pull request**.

GitHub esegue un controllo che verifica che il file OPML esista e che `sourceCount` corrisponda ai suoi feed. Il manutentore esamina le fonti, il loro rapporto con l'argomento e i dettagli del catalogo. Puoi rispondere alle domande nella pull request e aggiornare lo stesso branch se servono modifiche.

Prima che il pacchetto possa essere accettato, devi firmare il [Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md). CLA Assistant aggiunge un link alla tua pull request. Segui quel link per firmare.

## Se crei tu il file OPML

Usa OPML 2.0. Metti ogni cartella in un `<outline>` e ogni feed dentro una cartella. Ogni feed richiede un titolo, un `type` supportato e un `xmlUrl`. Puoi usare un [feedpack esistente](https://github.com/theopnv/monfil/tree/main/feedpacks) come esempio.

Se lavori sul progetto in locale, esegui `npm install` e poi `npm run check:feedpacks` prima di inviare. Il comando controlla i nomi dei file del catalogo e il numero delle fonti. Apri tu stesso i feed per verificare che i loro URL funzionino e che il contenuto sia adatto al tuo pacchetto.
