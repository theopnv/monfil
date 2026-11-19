---
title: Casos de uso
description: Três exemplos de configuração para ficar à frente na sua área, de um engenheiro de DevOps, de um fundador e de uma pesquisadora.
---

Estas três pessoas precisam se manter à frente na área delas. Um engenheiro de DevOps precisa saber primeiro quando uma ferramenta da stack muda. Um fundador precisa ver o que os concorrentes lançam e quais tendências crescem. Uma pesquisadora precisa ler os novos artigos antes que todos os citem. Cada pessoa cria um workspace, cola alguns links em **Adicionar um feed** e lê tudo em um único fluxo. Copie uma configuração e depois mude-a para se adequar à sua área.

Para adicionar uma fonte, selecione **+** no topo da barra de feeds e cole o link. O Monfil encontra o feed. A página [fontes compatíveis](../supported-sources/) lista o que você pode colar para cada fonte.

## Um engenheiro de DevOps

Sam chefia a equipe de plataforma de uma empresa de médio porte. Ela precisa saber quando uma ferramenta da stack lança uma versão, e precisa ver o que a comunidade discute nesta semana. Ela não quer verificar dez sites toda manhã.

Sam cria um workspace chamado **Plataforma** com estas fontes:

| Pasta | Cole | O que oferece |
| --- | --- | --- |
| Versões | `github.com/kubernetes/kubernetes` | Cada versão do Kubernetes, com as notas de versão |
| Versões | `github.com/opentofu/opentofu` | Cada versão do OpenTofu |
| Versões | `github.com/argoproj/argo-cd` | Cada versão do Argo CD |
| Blogs | `kubernetes.io/blog` | Posts do blog do Kubernetes |
| Blogs | `cncf.io/feed` | Posts do blog da CNCF |
| Comunidade | `hachyderm.io/tags/kubernetes` | Posts do Mastodon com a tag `#kubernetes` |
| Comunidade | `fosstodon.org/tags/devops` | Posts do Mastodon com a tag `#devops` |
| Comunidade | `@user@hachyderm.io` para cada engenheiro em quem Sam confia | Os posts dessa pessoa |

Sam não tem conta no Mastodon. O Monfil lê os feeds públicos das tags e das pessoas, então ela não precisa de uma.

As notas de versão chegam como itens completos, então Sam lê o que mudou sem abrir o GitHub. Quando uma versão menor traz uma mudança incompatível, Sam salva o item e o vincula ao chamado de atualização.

**Dica:** o feedpack Engenharia de Plataforma já tem versões do Kubernetes, do OpenTofu, do Helm e de outras ferramentas. Instale-o e depois adicione as suas próprias ferramentas.

## Um fundador

Alex cria sozinho um produto de análise web de código aberto. Ele precisa ver o que os concorrentes lançam e perceber as tendências cedo. Tem pouco tempo, então só sinais fortes entram no workspace.

Alex cria um workspace chamado **Mercado** com estas fontes:

| Pasta | Cole | O que oferece |
| --- | --- | --- |
| Concorrentes | `github.com/plausible/analytics` | Cada versão do Plausible |
| Concorrentes | `github.com/umami-software/umami` | Cada versão do Umami |
| Concorrentes | O blog de cada concorrente | Os posts de lançamento e os anúncios |
| Tendências | `news.ycombinator.com`, depois escolha **300+ pontos** | Só as histórias que chegam a 300 pontos |
| Tendências | `news.ycombinator.com`, depois escolha **Show HN** | O que outros criadores lançam |
| Menções | Um feed do Google Alerts com o nome do produto | Páginas novas que citam o produto |
| Pessoas | `@name.bsky.social` de fundadores da mesma área | Os posts deles no Bluesky |

O Hacker News oferece uma escolha de feeds. Alex escolhe um limite de pontos, para que o fluxo mostre as histórias que mais pessoas discutiram, e não o fluxo completo. Para o Google Alerts, a página [fontes compatíveis](../supported-sources/#google-alerts) mostra como obter o feed.

Uma versão de concorrente que lança um recurso do roadmap de Alex chega no mesmo dia. Ele não precisa de uma conta no Bluesky para seguir os fundadores.

**Dica:** o feedpack Fundadores e Empreendedores Solo já tem os feeds **Show HN** e **300+ pontos**. Instale-o e depois adicione os seus concorrentes.

## Uma pesquisadora

Priya trabalha com modelos de linguagem em um laboratório universitário. Ela precisa ler os novos artigos de algumas categorias todos os dias. Também quer saber quando uma biblioteca que o laboratório usa muda, e o que outros pesquisadores dizem sobre os novos artigos.

Priya cria um workspace chamado **Pesquisa** com estas fontes:

| Pasta | Cole | O que oferece |
| --- | --- | --- |
| Artigos | `arxiv.org/list/cs.CL/recent` | Novos artigos em Computação e Linguagem |
| Artigos | `arxiv.org/list/cs.LG/recent` | Novos artigos em Aprendizado de Máquina |
| Bibliotecas | `github.com/huggingface/transformers` | Cada versão do Transformers |
| Bibliotecas | `github.com/pytorch/pytorch` | Cada versão do PyTorch |
| Laboratórios | `huggingface.co/blog` | Posts do blog da Hugging Face |
| Pessoas | O perfil do Bluesky de cada pesquisador que Priya segue | Os posts e as threads de artigos dele |

O Monfil oculta os anúncios do arXiv de artigos substituídos, então uma nova versão de um artigo antigo não entra de novo. O arXiv não publica nos fins de semana, então o fluxo fica quieto no sábado e no domingo.

Priya usa a busca para encontrar todos os artigos sobre um tema nas categorias. Ela salva os artigos para ler depois na lista **Salvos**.

**Dica:** o feedpack IA já tem as categorias `cs.AI`, `cs.LG` e `cs.CL`, e as versões das principais bibliotecas de IA.

## Seguir pessoas sem conta

Bluesky e Mastodon publicam um feed para cada perfil público. O Mastodon também publica um feed para cada tag em um servidor. O Monfil lê esses feeds diretamente:

- Você não precisa de conta, de app nem de login em nenhuma das redes.
- Os posts chegam junto com as outras fontes no seu fluxo. Não há recomendações nem contagens de curtidas.
- O Monfil lê só posts públicos. Ele não consegue mostrar posts que exigem login, como posts só para seguidores.

Para seguir uma pessoa, cole o link do perfil dela ou o identificador. Use `@name.bsky.social` para o Bluesky e `@user@server` para o Mastodon, depois pressione Enter.
