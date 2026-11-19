---
title: Fontes compatíveis
description: O que você pode colar em Adicionar um feed e o que o Monfil acompanha em cada fonte.
---

Selecione **+** no topo da barra de feeds para abrir **Adicionar um feed**. Cole um link na caixa. O Monfil encontra o feed por trás do link. Você não precisa da URL do feed em si.

Os chips abaixo da caixa definem o tipo de fonte. Mantenha **Qualquer coisa** para deixar o Monfil detectar o tipo pelo link. Escolha um chip quando o Monfil não conseguir detectá-lo, ou quando você digitar uma forma curta, como um identificador. Para um identificador, pressione Enter para iniciar a verificação.

Alguns links levam a mais de um feed. Nesse caso, o Monfil mostra uma lista e seleciona o primeiro feed. Selecione o que você quer e depois selecione **Continuar**.

## Sites e blogs

Cole o endereço de qualquer página do site. O Monfil lê os links de feed que a página anuncia. Se a página não tiver nenhum, o Monfil tenta endereços comuns de feed no mesmo site, como `/feed` e `/rss.xml`.

## GitHub

| Cole | O Monfil acompanha |
| --- | --- |
| Um repositório, como `github.com/microsoft/playwright` | As versões do repositório |
| Um usuário ou uma organização, como `github.com/torvalds` | A atividade pública |
| `owner/repo`, com o chip **GitHub** | As versões do repositório |

## GitLab

Cole um link de projeto, como `gitlab.com/gitlab-org/gitlab`. O Monfil acompanha as versões do projeto. Para um GitLab auto-hospedado, escolha antes o chip **GitLab**.

## Hacker News

Cole `news.ycombinator.com`. O Monfil oferece estes feeds:

- **Página inicial**, do próprio Hacker News. Esta é a opção padrão.
- **100+ pontos** e **300+ pontos**, só com as histórias que chegam a essa pontuação.
- **Show HN** e **Ask HN**.

Os últimos quatro vêm de [hnrss.org](https://hnrss.org), um serviço gratuito que não faz parte do Hacker News. Um link para uma seção, como `news.ycombinator.com/show`, dá apenas essa seção.

## arXiv

Cole uma listagem de categoria, como `arxiv.org/list/cs.AI/recent`. O Monfil acompanha os anúncios diários dessa categoria. Ele oculta os artigos substituídos, porque são novas versões de artigos que você já viu. O arXiv não publica nos fins de semana.

## Bluesky e Mastodon sem conta

Você não precisa de uma conta no Bluesky ou no Mastodon para seguir pessoas lá. As duas redes publicam um feed para cada perfil público, e o Monfil o lê. Veja [Casos de uso](../use-cases/#seguir-pessoas-sem-conta).

## Bluesky

Cole um link de perfil, como `bsky.app/profile/bsky.app`, ou um identificador, como `@name.bsky.social`. Para um identificador de domínio próprio sem o `@`, escolha o chip **Bluesky**.

## Mastodon

Cole um identificador, como `@user@mastodon.social`. Você também pode colar um link de perfil ou de tag de qualquer servidor, como `hachyderm.io/@user` ou `hachyderm.io/tags/rust`.

## YouTube

Cole um link de canal, de identificador, de vídeo ou de playlist. Um link de vídeo segue o canal que o publicou.

## Conferências para desenvolvedores

Escolha o chip **Conferências**. Digite os temas, depois `in`, depois os lugares, e pressione Enter. Separe os itens de cada lista com vírgulas. Os lugares são opcionais. Use `online` para eventos online.

| Tipo | O Monfil acompanha |
| --- | --- |
| `devops` | Conferências de DevOps em todos os lugares |
| `kubernetes, cloud in France` | Conferências de Kubernetes ou de cloud na França |
| `java in Belgium, online` | Conferências de Java na Bélgica ou online |

Um tema combina com uma tag de conferência, como `java` ou `devops`. O Monfil troca os espaços de um tema por hífens, então `software testing` encontra a tag `software-testing`. Um lugar combina com uma cidade ou um país.

Você também pode colar um link do [developers.events](https://developers.events) sem o chip. Defina os filtros no site primeiro e depois copie o endereço. O Monfil usa os filtros de país, tema, tecnologia e idioma. Ele ignora o ano no endereço e mostra conferências de todos os anos. Se o link tiver outro filtro, como região, o Monfil pede que você o remova.

Se nenhuma conferência usar um tema ou um lugar, o Monfil avisa e sugere termos parecidos. Por exemplo, `test automation` sugere `testing`. Se o tema e o lugar estiverem corretos, mas nenhuma conferência combinar agora, o Monfil avisa. Você ainda pode adicionar o feed. Ele mostra um card quando uma conferência correspondente é anunciada.

O Monfil adiciona um card ao fluxo quando um destes eventos acontece:

- Uma conferência começa nos próximos 12 meses.
- A chamada de trabalhos (CFP) da conferência abre.
- A CFP fecha em 14 dias.
- A conferência começa em 30 dias.
- A conferência começa hoje.

Ao adicionar o feed, você recebe um card para cada evento que já aconteceu. O Monfil lê os dados do developers.events a cada atualização. Ele não guarda uma cópia da lista completa. Os dados têm a licença [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), e cada card indica a fonte.

## Vagas

Escolha o chip **Vagas**. Cole o quadro de vagas de uma empresa, como `jobs.lever.co/spotify` ou `boards.greenhouse.io/datadog`. Você também pode colar a página de carreiras da empresa. O Monfil procura nessa página um link para um quadro de vagas compatível (isso nem sempre funciona).

O Monfil lê os quadros de vagas públicos destes sistemas:

- Greenhouse
- Lever
- Ashby
- Workable
- SmartRecruiters
- Recruitee
- Teamtailor
- Personio

Outros sistemas, como o Workday, ainda não são compatíveis, então a cobertura não está completa.

Cada vaga aberta é um card. O card mostra a empresa, o lugar, o modo de trabalho e o salário, quando a vaga informa um. O Monfil lê o salário da própria vaga, quando ele está disponível.

O Monfil lista todas as vagas da empresa. Para manter só as funções que você quer, salve uma busca para cada função. Veja [Vagas](../jobs/).

Uma vaga permanece no fluxo enquanto a configuração de retenção a mantiver. O Monfil não remove uma vaga quando a empresa a preenche.

## Substack

Cole o endereço da publicação, como `name.substack.com` ou o domínio próprio. O Monfil encontra o feed. Você também pode adicionar `/feed` ao final do endereço por conta própria.

## Google Alerts

1. Abra o [Google Alerts](https://www.google.com/alerts) e crie um alerta.
2. Selecione **Mostrar opções**. Defina **Enviar para** como **Feed RSS**.
3. Selecione **Criar alerta**. Copie o link RSS da lista de alertas e cole-o no Monfil.

## Fontes que não funcionam

O X não publica feeds. O Reddit está encerrando os feeds RSS, então o Monfil não o suporta.
