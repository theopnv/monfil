---
title: Enviar um feedpack
description: Compartilhe uma coleção de feeds com outros leitores do Monfil.
---

Um feedpack é uma coleção de feeds sobre um assunto. Você pode criar um no Monfil e propô-lo para o catálogo de feedpacks. Você precisa de uma conta no GitHub para enviá-lo, mas pode usar o site do GitHub em todas as etapas.

Você vai enviar um arquivo OPML com os feeds e atualizar `feedpacks/index.json` para descrever o pacote. Um pull request pede ao responsável pelo Monfil que revise essas mudanças. O seu pacote aparece no catálogo depois que for aceito.

## 1. Crie o pacote no Monfil

1. Selecione **+** na barra à esquerda para criar um workspace para o assunto. Use **+** no topo da barra de feeds para adicionar os feeds que você quer compartilhar. Coloque-os em pastas úteis.
2. Abra cada feed. Verifique se ele publica conteúdo e se combina com o assunto. Remova duplicados e feeds quebrados.
3. Clique com o botão direito no ícone do workspace na barra à esquerda e selecione **Exportar como OPML**.
4. Salve o arquivo com um nome curto, feito de palavras minúsculas separadas por hífens, como `web-performance.opml`.

OPML é o formato de arquivo que o Monfil usa para mover uma lista de feeds e pastas entre aplicativos. A exportação salva os feeds desse workspace.

## 2. Faça uma cópia do projeto no GitHub

1. [Crie uma conta no GitHub](https://github.com/signup) se precisar. Entre e abra o [repositório do Monfil](https://github.com/theopnv/monfil).
2. Selecione **Fork**, depois **Criar fork**. O GitHub faz uma cópia na sua conta. O [guia de fork do GitHub](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) mostra esses botões em imagens.
3. No seu fork, abra o menu de branches acima da lista de arquivos. Ele mostra **main** no início. Digite um nome como `add-web-performance-pack`, depois selecione **Criar branch**. Um branch guarda as mudanças que você quer enviar. Mantenha-o selecionado para as duas mudanças de arquivo.

## 3. Envie o arquivo OPML

1. No seu fork, abra a pasta `feedpacks`.
2. Selecione **Adicionar arquivo**, depois **Enviar arquivos**. Escolha o arquivo OPML que você exportou.
3. Salve a mudança no branch que você criou. O GitHub pode chamar o botão de **Confirmar alterações** ou **Propor alterações**. Uma confirmação salva uma mudança na sua cópia.

## 4. Descreva o pacote no catálogo

1. Continue no seu fork e no mesmo branch. Abra `feedpacks/index.json` e selecione o ícone de lápis para editá-lo.
2. Adicione um objeto dentro da lista `packs`. Coloque uma vírgula entre o seu objeto e o anterior. Use este exemplo como guia:

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

Substitua os valores do exemplo pelos seus. Faça `slug` único entre os pacotes existentes, e faça `opml` corresponder exatamente ao nome do seu arquivo. `sourceCount` é o número de feeds, sem contar as pastas. Defina `updatedAt` como a data em que você verificou as fontes pela última vez, no formato `YYYY-MM-DD`. Use uma descrição curta e algumas tags de busca em minúsculas. Mantenha o valor `version` da raiz como está.

Salve esta mudança no mesmo branch do arquivo OPML.

## 5. Peça uma revisão

1. Volte ao [repositório original do Monfil](https://github.com/theopnv/monfil). Selecione **Pull requests**, depois **Nova pull request**.
2. Selecione **comparar entre forks**. Defina o repositório base como `theopnv/monfil` e o branch base como `main`. Defina o **fork de origem** como a sua cópia e o **branch de comparação** como o branch que você criou. O [guia de pull requests do GitHub](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) mostra esta tela.
3. Confira **Arquivos alterados**. Ele deve mostrar o seu arquivo OPML e a sua edição de `feedpacks/index.json`.
4. Dê ao pedido um título claro. Na descrição, diga o que o pacote cobre, como você escolheu os feeds e se alguma fonte precisa de contexto. Selecione **Criar pull request**.

O GitHub executa uma verificação para confirmar que o arquivo OPML existe e que `sourceCount` corresponde aos feeds. O responsável revisa as fontes, a adequação ao assunto e os detalhes do catálogo. Você pode responder às perguntas no pull request e atualizar o mesmo branch se precisar de mudanças.

Antes que o pacote possa ser aceito, você deve assinar o [Contributor License Agreement](https://github.com/theopnv/monfil/blob/main/CLA.md). O CLA Assistant adiciona um link ao seu pull request. Siga esse link para assinar.

## Se você criar o arquivo OPML por conta própria

Use OPML 2.0. Coloque cada pasta em um `<outline>` e cada feed dentro de uma pasta. Cada feed precisa de um título, de um `type` compatível e de um `xmlUrl`. Você pode usar um [feedpack existente](https://github.com/theopnv/monfil/tree/main/feedpacks) como exemplo.

Se você trabalha no projeto localmente, execute `npm install` e depois `npm run check:feedpacks` antes de enviar. Esse comando verifica os nomes dos arquivos do catálogo e a contagem de fontes. Abra os feeds você mesmo para conferir se as URLs funcionam e se o conteúdo combina com o seu pacote.
