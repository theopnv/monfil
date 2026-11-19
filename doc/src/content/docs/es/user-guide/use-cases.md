---
title: Casos de uso
description: Tres ejemplos de configuración para mantenerte al día en tu campo, para un ingeniero de DevOps, un fundador y una investigadora.
---

Estas tres personas deben mantenerse al día en su campo. Un ingeniero de DevOps debe saber primero cuando cambia una herramienta de su stack. Un fundador debe ver qué lanzan los competidores y qué tendencias crecen. Una investigadora debe leer los artículos nuevos antes de que todos los citen. Cada una crea un workspace, pega algunos enlaces en **Añadir una fuente** y lee todo en un solo flujo. Copia una configuración y luego cámbiala para tu campo.

Para añadir una fuente, selecciona **+** en la parte superior de la barra de fuentes y pega el enlace. Monfil encuentra la fuente. La página de [fuentes compatibles](../supported-sources/) lista lo que puedes pegar para cada tipo de fuente.

## Un ingeniero de DevOps

Sam dirige el equipo de plataforma de una empresa mediana. Ella debe saber cuándo una herramienta del stack publica una versión, y debe ver de qué habla la comunidad esta semana. No quiere revisar diez sitios cada mañana.

Sam crea un workspace llamado **Plataforma** con estas fuentes:

| Carpeta | Pega | Qué obtiene |
| --- | --- | --- |
| Versiones | `github.com/kubernetes/kubernetes` | Cada versión de Kubernetes, con sus notas de la versión |
| Versiones | `github.com/opentofu/opentofu` | Cada versión de OpenTofu |
| Versiones | `github.com/argoproj/argo-cd` | Cada versión de Argo CD |
| Blogs | `kubernetes.io/blog` | Publicaciones del blog de Kubernetes |
| Blogs | `cncf.io/feed` | Publicaciones del blog de CNCF |
| Comunidad | `hachyderm.io/tags/kubernetes` | Publicaciones de Mastodon con la etiqueta `#kubernetes` |
| Comunidad | `fosstodon.org/tags/devops` | Publicaciones de Mastodon con la etiqueta `#devops` |
| Comunidad | `@user@hachyderm.io` para cada ingeniero en quien Sam confía | Las publicaciones de esa persona |

Sam no tiene cuenta en Mastodon. Monfil lee las fuentes públicas de las etiquetas y de las personas, así que ella no necesita una cuenta.

Las notas de versión llegan como elementos completos, así que Sam lee lo que cambió sin abrir GitHub. Cuando una versión menor tiene un cambio incompatible, Sam guarda el elemento y lo enlaza en el ticket de actualización.

**Consejo:** el feedpack de Ingeniería de Plataforma ya tiene versiones de Kubernetes, OpenTofu, Helm y otras herramientas. Instálalo y luego añade tus propias herramientas.

## Un fundador

Alex construye solo un producto de analítica web de código abierto. Él debe ver lo que lanzan los competidores, y debe detectar tendencias pronto. Tiene poco tiempo, así que solo entran en el workspace las señales fuertes.

Alex crea un workspace llamado **Mercado** con estas fuentes:

| Carpeta | Pega | Qué obtiene |
| --- | --- | --- |
| Competidores | `github.com/plausible/analytics` | Cada versión de Plausible |
| Competidores | `github.com/umami-software/umami` | Cada versión de Umami |
| Competidores | El blog de cada competidor | Sus anuncios y publicaciones de lanzamiento |
| Tendencias | `news.ycombinator.com`, luego elige **300+ puntos** | Solo las historias que llegan a 300 puntos |
| Tendencias | `news.ycombinator.com`, luego elige **Show HN** | Lo que lanzan otros creadores |
| Menciones | Una fuente de Alertas de Google con el nombre del producto | Páginas nuevas que mencionan el producto |
| Personas | `@name.bsky.social` para fundadores del mismo sector | Sus publicaciones en Bluesky |

Hacker News ofrece varias fuentes. Alex elige un umbral de puntos, así que el flujo muestra las historias que más personas comentaron, y no el flujo completo. Para Alertas de Google, la página de [fuentes compatibles](../supported-sources/#google-alerts) muestra cómo obtener la fuente.

Una versión de un competidor que incluye una función de la hoja de ruta de Alex llega el mismo día. Él no necesita una cuenta de Bluesky para seguir a los fundadores.

**Consejo:** el feedpack de Fundadores y Emprendedores en solitario ya tiene las fuentes **Show HN** y **300+ puntos**. Instálalo y luego añade a tus competidores.

## Una investigadora

Priya trabaja en modelos de lenguaje en un laboratorio universitario. Ella debe leer cada día los artículos nuevos de algunas categorías. También quiere saber cuándo cambia una biblioteca que usa el laboratorio, y qué dicen otros investigadores sobre los artículos nuevos.

Priya crea un workspace llamado **Investigación** con estas fuentes:

| Carpeta | Pega | Qué obtiene |
| --- | --- | --- |
| Artículos | `arxiv.org/list/cs.CL/recent` | Artículos nuevos de Computación y Lenguaje |
| Artículos | `arxiv.org/list/cs.LG/recent` | Artículos nuevos de Aprendizaje Automático |
| Bibliotecas | `github.com/huggingface/transformers` | Cada versión de Transformers |
| Bibliotecas | `github.com/pytorch/pytorch` | Cada versión de PyTorch |
| Laboratorios | `huggingface.co/blog` | Publicaciones del blog de Hugging Face |
| Personas | El perfil de Bluesky de cada investigador que Priya sigue | Sus publicaciones y hilos sobre artículos |

Monfil oculta los anuncios de arXiv de los artículos reemplazados, así que una versión nueva de un artículo antiguo no vuelve a entrar. arXiv no publica los fines de semana, así que el flujo está tranquilo el sábado y el domingo.

Priya usa la búsqueda para encontrar todos los artículos sobre un tema en las categorías. Guarda los artículos para leerlos más tarde en la lista **Guardados**.

**Consejo:** el feedpack de IA ya tiene las categorías `cs.AI`, `cs.LG` y `cs.CL`, y las versiones de las bibliotecas clave de IA.

## Seguir a personas sin cuenta

Bluesky y Mastodon publican una fuente para cada perfil público. Mastodon también publica una fuente para cada etiqueta de un servidor. Monfil lee estas fuentes directamente:

- No necesitas una cuenta, una aplicación ni un inicio de sesión en ninguna de las dos redes.
- Las publicaciones llegan junto con las otras fuentes en tu flujo. No hay recomendaciones ni contadores de me gusta.
- Monfil lee solo publicaciones públicas. No puede mostrar publicaciones que requieren inicio de sesión, como las publicaciones solo para seguidores.

Para seguir a una persona, pega el enlace de su perfil o su nombre de usuario. Usa `@name.bsky.social` para Bluesky y `@user@server` para Mastodon, y luego pulsa Enter.
