---
title: Ricerca e ricerche salvate
description: Cerca nel flusso con frasi, OR, esclusioni e titolo, e mantieni una ricerca come pillola sopra il flusso.
---

La casella di ricerca sopra il flusso filtra gli elementi del workspace corrente. Funziona allo stesso modo per ogni fonte.

## Sintassi di ricerca

| Tipo | Monfil mostra |
| --- | --- |
| `rust async` | Elementi che contengono entrambe le parole |
| `"machine learning"` | Elementi che contengono la frase esatta |
| `kubernetes OR k8s` | Elementi che contengono una delle due parole. Scrivi `OR` in maiuscolo. |
| `-sponsored` | Elementi senza la parola. Funziona anche con una frase: `-"press release"`. |
| `title:release` | Elementi con la parola nel titolo. Funziona anche con una frase: `title:"release notes"`. |

Puoi combinare le forme: `title:"release notes" -beta`. Una catena come `go OR rust OR zig` funziona. Le parentesi non funzionano, e una parola con `-` non può far parte di un `OR`. Un trattino dentro una parola, come in `front-end`, fa parte della parola.

Una parola di tre lettere o meno, come `ci`, corrisponde solo a parole intere, quindi non trova `producing`. Ogni altra parola corrisponde anche dentro parole più lunghe, quindi `engineer` trova `engineers`. Scrivi una parola corta tra virgolette, come in `"ci"`, per cercarla anche dentro altre parole.

Senza `title:`, Monfil cerca nel titolo, nei primi 200 caratteri del testo e nel nome del feed. Per un'offerta di lavoro, cerca anche il luogo e la modalità di lavoro. Non cerca nel testo completo di un elemento.

## Salva una ricerca

1. Scrivi una ricerca. Compare un pulsante **Salva ricerca** accanto alla casella di ricerca.
2. Seleziona **Salva ricerca**, scrivi un nome e premi Invio.

La ricerca ora è una pillola sopra il flusso. Il numero sulla pillola è il conteggio degli elementi non letti che corrispondono. Le pillole appartengono al workspace in cui le hai create.

- Seleziona una pillola per eseguire la sua ricerca. Selezionala di nuovo per cancellare la ricerca.
- Una pillola mostra elementi letti e non letti, quindi un elemento resta nella sua ricerca nei giorni successivi alla lettura. Seleziona **Non letti** per nascondere di nuovo gli elementi letti.
- Punta con il mouse su una pillola e seleziona la croce per eliminarla.
- Fai clic destro su una pillola, oppure portaci sopra il focus da tastiera e premi F2, per rinominarla.
- Se cambi la ricerca di una pillola selezionata, **Aggiorna** cambia la pillola. **Salva come nuova** crea una seconda pillola.
- Quando ci sono più pillole di quante la riga ne possa mostrare, scorri la riga in orizzontale oppure seleziona il menu con tre puntini per vederle tutte.
