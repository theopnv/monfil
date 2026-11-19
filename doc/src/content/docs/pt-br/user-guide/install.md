---
title: Instalar o Monfil
description: Baixe e instale o Monfil no macOS, no Windows ou no Linux.
---

O Monfil é gratuito. Escolha o seu sistema:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

Você precisa do macOS 13 Ventura ou mais recente. Para ver qual chip o seu Mac tem, abra o menu Apple e selecione **Sobre Este Mac**. Veja a linha **Chip** ou **Processador**.

1. Baixe o arquivo do seu chip na versão mais recente:
   - Apple silicon (a linha começa com **Apple**): [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel (a linha começa com **Intel**): [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. Abra o arquivo baixado. Aparece uma janela com o ícone do Monfil e uma pasta Aplicativos.
3. Arraste o ícone do Monfil para a pasta Aplicativos.
4. Feche a janela e ejete o disco do Monfil na barra lateral do Finder.
5. Abra o Monfil pela pasta Aplicativos ou pelo Launchpad.

A Apple verificou esta versão do Monfil, então o macOS a abre sem aviso de segurança.

O Monfil se atualiza sozinho. Quando uma nova versão está pronta, aparece uma mensagem com o botão **Reiniciar**. Selecione **Reiniciar** para concluir a atualização. As atualizações funcionam só quando você abre o Monfil pela pasta Aplicativos.

## Windows

O Monfil funciona no Windows 10 e no Windows 11.

### Microsoft Store (recomendada)

1. Abra o [Monfil na Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. Selecione **Obter** ou **Instalar**.
3. Abra o Monfil pelo menu Iniciar.

A Store mantém o Monfil atualizado.

Você também pode instalar a versão da Store pelo terminal, com o winget:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### Arquivo de instalação

Use esta opção se não puder usar a Microsoft Store.

1. Abra a [versão mais recente do Monfil](https://github.com/theopnv/monfil/releases/latest).
2. Em **Assets**, baixe o arquivo que termina em `Setup.exe`.
3. Abra o arquivo baixado. O Monfil é instalado e abre.

O Windows pode mostrar **O Windows protegeu o seu PC**, porque este arquivo não tem assinatura paga. Selecione **Mais informações** e depois **Executar assim mesmo**. A versão da Store não mostra essa mensagem.

O Monfil se atualiza sozinho. Quando uma nova versão está pronta, aparece uma mensagem com o botão **Reiniciar**. Selecione **Reiniciar** para concluir a atualização.

## Linux

O Monfil funciona em computadores Intel e AMD de 64 bits.

1. Abra a [versão mais recente do Monfil](https://github.com/theopnv/monfil/releases/latest).
2. Em **Assets**, baixe o arquivo do seu sistema:
    - No Debian, no Ubuntu ou no Linux Mint, o arquivo que termina em `.deb`.
    - No Fedora, no RHEL ou no openSUSE, o arquivo que termina em `.rpm`.
3. Abra o arquivo baixado com a sua central de software, ou instale-o pelo terminal, a partir da pasta Downloads:
    - No Debian, no Ubuntu ou no Linux Mint: `sudo apt install ./monfil_*.deb`
    - No Fedora ou no RHEL: `sudo dnf install ./monfil-*.rpm`
4. Abra o Monfil pelo menu de aplicativos.

O Monfil não se atualiza sozinho no Linux. Para atualizar, baixe e instale o novo arquivo da versão mais recente.

## O Monfil é seguro?

O código do Monfil é público, e qualquer pessoa pode lê-lo. O GitHub gera cada versão a partir desse código, com um [fluxo de trabalho público](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## Próximo passo

Siga [Usar o Monfil](../home/) para adicionar feeds e configurar um workspace.
