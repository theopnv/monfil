---
title: Busca e buscas salvas
description: Busque no fluxo com frases, OR, exclusões e título, e mantenha uma busca como pílula acima do fluxo.
---

A caixa de busca acima do fluxo filtra os itens do workspace atual. Ela funciona igual para todas as fontes.

## Sintaxe de busca

| Tipo | O Monfil mostra |
| --- | --- |
| `rust async` | Itens que contêm as duas palavras |
| `"machine learning"` | Itens que contêm a frase exata |
| `kubernetes OR k8s` | Itens que contêm uma das palavras. Escreva `OR` em maiúsculas. |
| `-sponsored` | Itens sem a palavra. Também funciona com frase: `-"press release"`. |
| `title:release` | Itens com a palavra no título. Também funciona com frase: `title:"release notes"`. |

Você pode combinar as formas: `title:"release notes" -beta`. Uma cadeia como `go OR rust OR zig` funciona. Colchetes não funcionam, e uma palavra com `-` não pode fazer parte de um `OR`. Um hífen dentro de uma palavra, como em `front-end`, faz parte da palavra.

Uma palavra de três letras ou menos, como `ci`, encontra só palavras inteiras, então não encontra `producing`. Qualquer outra palavra também encontra dentro de palavras maiores, então `engineer` encontra `engineers`. Coloque uma palavra curta entre aspas, como em `"ci"`, para encontrá-la também dentro de outras palavras.

Sem `title:`, o Monfil procura no título, nos primeiros 200 caracteres do texto e no nome do feed. Para uma vaga, ele também procura no lugar e no modo de trabalho. Ele não busca o texto completo de um item.

## Salvar uma busca

1. Digite uma busca. Um botão **Salvar busca** aparece ao lado da caixa de busca.
2. Selecione **Salvar busca**, digite um nome e pressione Enter.

A busca agora é uma pílula acima do fluxo. O número na pílula é a contagem de itens não lidos que correspondem. As pílulas pertencem ao workspace em que você as criou.

- Selecione uma pílula para executar a busca dela. Selecione de novo para limpar a busca.
- Uma pílula mostra itens lidos e não lidos, então um item continua na busca nos dias depois que você o lê. Selecione **Não lidos** para ocultar de novo os itens lidos.
- Aponte para uma pílula e selecione o X para excluí-la.
- Clique com o botão direito em uma pílula, ou foque nela e pressione F2, para renomeá-la.
- Se você mudar a busca de uma pílula selecionada, **Atualizar** muda a pílula. **Salvar como nova** cria uma segunda pílula.
- Quando há mais pílulas do que a linha consegue mostrar, role a linha para o lado ou selecione o menu com três pontos para ver todas.
