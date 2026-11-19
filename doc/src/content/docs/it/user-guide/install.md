---
title: Installa Monfil
description: Scarica e installa Monfil su macOS, Windows o Linux.
---

Monfil è gratuito. Scegli il tuo sistema:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

Ti serve macOS 13 Ventura o una versione successiva. Per vedere quale chip ha il tuo Mac, apri il menu Apple e seleziona **Info su questo Mac**. Guarda la riga **Chip** o **Processore**.

1. Scarica il file per il tuo chip dall'ultima versione:
   - Apple silicon (la riga inizia con **Apple**): [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel (la riga inizia con **Intel**): [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. Apri il file scaricato. Compare una finestra con l'icona di Monfil e una cartella Applicazioni.
3. Trascina l'icona di Monfil sulla cartella Applicazioni.
4. Chiudi la finestra, poi espelli il disco Monfil dalla barra laterale del Finder.
5. Apri Monfil dalla cartella Applicazioni o da Launchpad.

Apple ha controllato questa versione di Monfil, quindi macOS la apre senza avvisi di sicurezza.

Monfil si aggiorna da solo. Quando una nuova versione è pronta, compare un messaggio con il pulsante **Riavvia**. Seleziona **Riavvia** per completare l'aggiornamento. Gli aggiornamenti funzionano solo se apri Monfil dalla cartella Applicazioni.

## Windows

Monfil funziona su Windows 10 e Windows 11.

### Microsoft Store (consigliato)

1. Apri [Monfil nel Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. Seleziona **Ottieni** oppure **Installa**.
3. Apri Monfil dal menu Start.

Lo Store mantiene Monfil aggiornato.

Puoi anche installare la versione dello Store da un terminale con winget:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### File di installazione

Usa questa opzione se non puoi usare il Microsoft Store.

1. Apri [l'ultima versione di Monfil](https://github.com/theopnv/monfil/releases/latest).
2. In **Asset**, scarica il file che termina con `Setup.exe`.
3. Apri il file scaricato. Monfil si installa e si apre.

Windows può mostrare **Windows ha protetto il PC**, perché questo file non ha una firma a pagamento. Seleziona **Ulteriori informazioni**, poi **Esegui comunque**. La versione dello Store non mostra questo messaggio.

Monfil si aggiorna da solo. Quando una nuova versione è pronta, compare un messaggio con il pulsante **Riavvia**. Seleziona **Riavvia** per completare l'aggiornamento.

## Linux

Monfil funziona su computer Intel e AMD a 64 bit.

1. Apri [l'ultima versione di Monfil](https://github.com/theopnv/monfil/releases/latest).
2. In **Asset**, scarica il file per il tuo sistema:
    - Su Debian, Ubuntu o Linux Mint, il file che termina con `.deb`.
    - Su Fedora, RHEL o openSUSE, il file che termina con `.rpm`.
3. Apri il file scaricato con il tuo centro software, oppure installalo da un terminale nella cartella Download:
    - Su Debian, Ubuntu o Linux Mint: `sudo apt install ./monfil_*.deb`
    - Su Fedora o RHEL: `sudo dnf install ./monfil-*.rpm`
4. Apri Monfil dal menu delle applicazioni.

Monfil non si aggiorna da solo su Linux. Per aggiornarlo, scarica e installa il nuovo file dall'ultima versione.

## Monfil è sicuro?

Il codice di Monfil è pubblico, e chiunque può leggerlo. GitHub compila ogni versione da quel codice con un [flusso di lavoro pubblico](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## Passo successivo

Segui [Usa Monfil](../home/) per aggiungere feed e configurare un workspace.
