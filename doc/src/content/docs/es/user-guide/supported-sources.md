---
title: Fuentes compatibles
description: Qué puedes pegar en Añadir una fuente, y qué sigue Monfil en cada tipo de fuente.
---

Selecciona **+** en la parte superior de la barra de fuentes para abrir **Añadir una fuente**. Pega un enlace en el cuadro. Monfil encuentra la fuente detrás del enlace. No necesitas la URL de la fuente en sí.

Los chips debajo del cuadro definen el tipo de fuente. Deja **Cualquiera** para que Monfil detecte el tipo a partir del enlace. Elige un chip cuando Monfil no pueda detectarlo, o cuando escribas una forma corta, como un nombre de usuario. Para un nombre de usuario, pulsa Enter para iniciar la comprobación.

Algunos enlaces llevan a más de una fuente. Entonces Monfil muestra una lista y selecciona la primera fuente. Selecciona la que quieres y luego selecciona **Continuar**.

## Sitios web y blogs

Pega la dirección de cualquier página del sitio. Monfil lee los enlaces de fuente que la página anuncia. Si la página no tiene ninguno, Monfil prueba direcciones de fuente comunes del mismo sitio, como `/feed` y `/rss.xml`.

## GitHub

| Pega | Monfil sigue |
| --- | --- |
| Un repositorio, como `github.com/microsoft/playwright` | Las versiones del repositorio |
| Un usuario o una organización, como `github.com/torvalds` | La actividad pública |
| `propietario/repositorio`, con el chip **GitHub** | Las versiones del repositorio |

## GitLab

Pega el enlace de un proyecto, como `gitlab.com/gitlab-org/gitlab`. Monfil sigue las versiones del proyecto. Para un GitLab autoalojado, elige primero el chip **GitLab**.

## Hacker News

Pega `news.ycombinator.com`. Monfil ofrece estas fuentes:

- **Portada**, de Hacker News. Es la opción predeterminada.
- **100+ puntos** y **300+ puntos**, solo con las historias que alcanzan esa puntuación.
- **Show HN** y **Ask HN**.

Las últimas cuatro vienen de [hnrss.org](https://hnrss.org), un servicio gratuito que no forma parte de Hacker News. Un enlace a una sección, como `news.ycombinator.com/show`, da solo esa sección.

## arXiv

Pega el listado de una categoría, como `arxiv.org/list/cs.AI/recent`. Monfil sigue los anuncios diarios de esa categoría. Oculta los artículos reemplazados, porque son versiones nuevas de artículos que ya viste. arXiv no publica los fines de semana.

## Bluesky y Mastodon sin cuenta

No necesitas una cuenta de Bluesky ni de Mastodon para seguir a personas en esas redes. Ambas redes publican una fuente para cada perfil público, y Monfil la lee. Consulta [Casos de uso](../use-cases/#seguir-a-personas-sin-cuenta).

## Bluesky

Pega el enlace de un perfil, como `bsky.app/profile/bsky.app`, o un nombre de usuario, como `@name.bsky.social`. Para un nombre de usuario en un dominio personalizado sin el `@`, elige el chip **Bluesky**.

## Mastodon

Pega un nombre de usuario, como `@user@mastodon.social`. También puedes pegar el enlace de un perfil o de una etiqueta de cualquier servidor, como `hachyderm.io/@user` o `hachyderm.io/tags/rust`.

## YouTube

Pega el enlace de un canal, un nombre de usuario, un video o una lista de reproducción. Un enlace de video sigue al canal que lo publicó.

## Conferencias de desarrolladores

Elige el chip **Conferencias**. Escribe temas, luego `in`, luego lugares, y pulsa Enter. Separa los elementos de cada lista con comas. Los lugares son opcionales. Usa `online` para los eventos en línea.

| Escribe | Monfil sigue |
| --- | --- |
| `devops` | Conferencias de DevOps en todos los lugares |
| `kubernetes, cloud in France` | Conferencias de Kubernetes o de nube en Francia |
| `java in Belgium, online` | Conferencias de Java en Bélgica o en línea |

Un tema coincide con una etiqueta de conferencia, como `java` o `devops`. Monfil cambia los espacios de un tema por guiones, así que `software testing` encuentra la etiqueta `software-testing`. Un lugar coincide con una ciudad o un país.

También puedes pegar un enlace de [developers.events](https://developers.events) sin el chip. Primero define los filtros en el sitio y luego copia la dirección. Monfil usa los filtros de país, tema, tecnología e idioma. Ignora el año de la dirección y muestra conferencias de todos los años. Si el enlace tiene otro filtro, como la región, Monfil te indica que lo quites.

Si ninguna conferencia usa un tema o un lugar, Monfil te lo indica y sugiere coincidencias cercanas. Por ejemplo, `test automation` sugiere `testing`. Si el tema y el lugar son correctos, pero ninguna conferencia coincide ahora, Monfil te lo indica. Aun así puedes añadir la fuente. Muestra una tarjeta cuando se anuncia una conferencia que coincide.

Monfil añade una tarjeta al flujo cuando ocurre uno de estos eventos:

- Una conferencia empieza en los próximos 12 meses.
- Se abre su convocatoria de ponencias (CFP).
- Su CFP cierra en 14 días.
- Empieza dentro de 30 días.
- Empieza hoy.

Cuando añades la fuente, recibes una tarjeta por cada evento que ya ocurrió. Monfil lee los datos de developers.events en cada actualización. No guarda una copia de la lista completa. Los datos tienen la licencia [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), y cada tarjeta indica su origen.

## Empleos

Elige el chip **Empleos**. Pega el portal de empleo de una empresa, como `jobs.lever.co/spotify` o `boards.greenhouse.io/datadog`. También puedes pegar la página de carreras de la empresa. Monfil busca en la página un enlace a un portal de empleo compatible (esto no siempre funciona).

Monfil lee los portales de empleo públicos de estos sistemas:

- Greenhouse
- Lever
- Ashby
- Workable
- SmartRecruiters
- Recruitee
- Teamtailor
- Personio

Otros sistemas, como Workday, todavía no son compatibles, así que la cobertura no está completa.

Cada oferta abierta es una tarjeta. La tarjeta muestra la empresa, el lugar, la modalidad de trabajo y el salario cuando la oferta lo indica. Monfil lee el salario de la oferta cuando está disponible.

Monfil muestra todas las ofertas de la empresa. Para dejar solo los puestos que quieres, guarda una búsqueda para cada puesto. Consulta [Empleos](../jobs/).

Una oferta se queda en el flujo mientras la configuración de retención la conserve. Monfil no elimina una oferta cuando la empresa la cubre.

## Substack

Pega la dirección de la publicación, como `name.substack.com` o su dominio personalizado. Monfil encuentra la fuente. También puedes añadir `/feed` al final de la dirección tú mismo.

## Google Alerts

1. Abre [Alertas de Google](https://www.google.com/alerts) y crea una alerta.
2. Selecciona **Mostrar opciones**. Pon **Enviar a** en **Fuente RSS**.
3. Selecciona **Crear alerta**. Copia el enlace RSS de la lista de alertas y pégalo en Monfil.

## Fuentes que no funcionan

X no publica fuentes. Reddit está dejando de ofrecer sus fuentes RSS, así que Monfil no lo admite.
