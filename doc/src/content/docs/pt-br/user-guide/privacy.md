---
title: Aviso de privacidade
description: Como o site e o app de desktop do Monfil tratam os dados.
---

:::note
Esta tradução é um rascunho feito por máquina. Em caso de diferença, a [versão em inglês](../../../user-guide/privacy/) é a referência.
:::

Última atualização: 23 de outubro de 2026.

## Site da documentação

Este site usa o [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) para medir visitas e o tempo de carregamento das páginas. Os mantenedores do Monfil usam essas estatísticas para melhorar a documentação e encontrar páginas lentas.

Os relatórios de análise incluem caminhos de páginas, sites de origem, país, navegador, sistema operacional, tipo de dispositivo e tempos de carregamento. O seu navegador carrega um script da Cloudflare e envia medições para a Cloudflare. A Cloudflare recebe o seu endereço IP quando o seu navegador faz essas requisições. Os relatórios de análise não dão aos mantenedores o seu endereço IP.

A Cloudflare afirma que o Web Analytics não usa cookies nem armazenamento local para coletar métricas de uso, e que não identifica visitantes por fingerprinting. Ele não rastreia visitantes entre sites. Veja a [documentação de coleta de dados](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/) para detalhes.

A Cloudflare mantém os dados de análise não amostrados por sete dias e depois usa dados amostrados para estatísticas de longo prazo. O painel dá acesso aos seis meses anteriores. Veja as [perguntas frequentes do Web Analytics](https://developers.cloudflare.com/web-analytics/faq/) sobre os períodos de amostragem e de acesso aos relatórios.

A Cloudflare, Inc. tem sede nos Estados Unidos. A sua [política de privacidade](https://www.cloudflare.com/privacypolicy/) explica como ela trata os dados de requisições, por quanto tempo guarda dados pessoais e quais salvaguardas usa para transferências para fora do Espaço Econômico Europeu.

### Hospedagem do site e armazenamento no navegador

A Cloudflare hospeda este site. A Cloudflare recebe o seu endereço IP e os detalhes da requisição quando você abre uma página. Veja a [política de privacidade da Cloudflare](https://www.cloudflare.com/privacypolicy/).

O site guarda o tema de cores que você escolheu no armazenamento local do seu navegador. Essa configuração fica no seu dispositivo até você mudá-la ou limpar os dados armazenados do site. Ela é separada da análise da Cloudflare.

Você pode bloquear o script da Cloudflare com o seu navegador ou com um bloqueador de conteúdo e continuar lendo a documentação.

### Perguntas e direitos de privacidade

O mantenedor do site do Monfil responde por este site. Para perguntas ou pedidos sobre os seus dados pessoais, envie um e-mail para [hello@monfil.app](mailto:hello@monfil.app).

## App de desktop

O Monfil é um leitor de feeds para desktop. Ele não tem conta e não tem servidor do Monfil. Ele guarda os seus feeds, os artigos salvos e o estado de leitura no seu dispositivo. Algumas configurações de exibição usam armazenamento local. Você pode encontrar e fazer backup do banco de dados em Configurações.

### Estatísticas anônimas de uso (opcional)

O Monfil pode enviar estatísticas anônimas de uso. Elas ficam desativadas até você concordar. Depois que você adicionar um feed e abrir o app duas vezes, o Monfil mostra um card com dois botões de mesmo tamanho, **Compartilhar estatísticas de uso** e **Não, obrigado**. Se você fechar o card, o Monfil pergunta de novo depois, no máximo mais uma vez, após 14 dias. Você pode mudar a sua escolha a qualquer momento em **Configurações > Privacidade**. **Ver o que é enviado** mostra o resumo que o Monfil enviaria hoje.

Se você concordar, o Monfil conta, no seu dispositivo, o que você faz. Uma vez por dia, ele envia um evento `daily_summary` para cada dia em que você usou o app. Quando você concorda, ele também envia um evento `consent_granted` sem dados. O evento `daily_summary` contém:

- Contagens do dia: artigos abertos, extrações de texto completo, feeds adicionados, feeds removidos, atualizações manuais, itens salvos, feedpacks instalados, arquivos OPML importados, arquivos OPML exportados, backups feitos, workspaces criados, trocas de workspace, buscas e embeds carregados.
- Contagens de falhas do dia: falhas na atualização de feeds, falhas na extração de artigos, falhas em requisições internas e falhas da interface. São apenas números. Não contêm texto de erro.
- O estado da sua biblioteca: uma faixa de tamanho para os seus feeds (`0`, `1-5`, `6-20`, `21-100` ou `100+`), o número de workspaces, o número de pastas e os tipos de feed que você usa, como `rss+youtube`.
- As suas configurações de exibição: densidade, tema, idioma da interface do Monfil, se os itens lidos ficam ocultos, se os itens são marcados como lidos ao rolar, se os links abrem no navegador e se a navegação pelo teclado está ativa.
- O dia que o evento cobre, a versão do Monfil, o seu sistema operacional e a versão dele, a sua configuração de idioma e a versão do mecanismo web do Monfil.

O evento nunca contém nome de feed, link, texto de artigo, texto de busca nem um nome seu. O Monfil não envia nenhum identificador duradouro. Cada requisição usa um novo ID de sessão aleatório.

[Aptabase](https://aptabase.com) recebe os eventos. A Technov Solutions SRL, empresa com sede em Bucareste, na Romênia, opera o Aptabase. Ela atua como operadora para o mantenedor do Monfil, sob o seu [acordo de processamento de dados](https://aptabase.com/legal/dpa). O Monfil usa a região UE (`eu.aptabase.com`). O Aptabase afirma que processa e armazena os dados de contas da região UE somente dentro da União Europeia.

O Aptabase deriva, no servidor dele, um ID de usuário anônimo como um hash do seu endereço IP e do user agent, com um salt. O Aptabase afirma que o salt é diferente para cada app e é descartado a cada 24 horas. O ID muda todos os dias, então o mantenedor não consegue acompanhar uma mesma pessoa de um dia para o outro. O Aptabase afirma que guarda dados de análise por até 5 anos. Veja a [política de privacidade do Aptabase](https://aptabase.com/legal/privacy) para detalhes.

A base legal é o seu consentimento. A sua escolha fica armazenada no seu dispositivo, com a data e a versão deste aviso. Para retirar o consentimento, desative **Compartilhar estatísticas anônimas de uso** em Configurações. Depois disso, o Monfil para de contar, para de enviar e exclui as contagens que guardou no seu dispositivo. Eventos já recebidos não podem ser ligados a você. Para perguntar sobre os seus dados, envie um e-mail para [hello@monfil.app](mailto:hello@monfil.app). Uma versão do Monfil sem chave de analytics, como uma versão que você mesmo compila, não envia nada.

### Requisições a outros sites

O Monfil pede os feeds aos seus publicadores quando os atualiza. Ao abrir um artigo, o Monfil pode pedir a página do publicador para obter o texto completo. Imagens e ícones de feed podem ser carregados de sites remotos quando aparecem na tela. Esses sites recebem a requisição e podem ver informações como o seu endereço IP e os detalhes do app ou do navegador.

Quando você adiciona um feed, o Monfil pode pedir a página que você colou e endereços comuns de feed no mesmo site. Para um link do Hacker News, ele verifica feeds em [hnrss.org](https://hnrss.org). Para mostrar um ícone de um projeto do GitLab ou de um perfil do Bluesky, ele pede o avatar à API do GitLab ou à API pública do Bluesky. Um feed de conferências pede a lista de eventos a [developers.events](https://developers.events) quando você o adiciona e em cada atualização. O GitHub Pages hospeda essa lista.

Abrir um artigo ou outro link no seu navegador também conecta ao site vinculado. Esse navegador usa as próprias configurações de privacidade.

### Mídia incorporada

O Monfil aceita embeds do YouTube, do X, do Vimeo, do Instagram e do Spotify. Ele mostra um card primeiro. O Monfil cria o quadro incorporado do provedor só depois que você clica em **Carregar** nesse card. Cada embed precisa de um clique próprio toda vez que você abre o artigo. Você pode ler o artigo sem carregar o embed.

Quando você carrega um embed, o seu dispositivo se conecta ao provedor. O provedor recebe uma requisição para aquele vídeo, post ou item de áudio. Ele pode ver o seu endereço IP e os detalhes do app ou do navegador. Ele pode usar cookies ou outro armazenamento no quadro dele. O Monfil não controla as práticas de dados do provedor. O link **Abrir em** conecta ao provedor no seu navegador, se você clicar nele.

Carregar um embed não impede que as imagens ou os ícones do artigo sejam carregados dos próprios sites.

Políticas de privacidade dos provedores: [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/) e [Spotify](https://www.spotify.com/legal/privacy-policy/).
