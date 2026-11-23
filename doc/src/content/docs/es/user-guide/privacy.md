---
title: Aviso de privacidad
description: Cómo el sitio web y la aplicación de escritorio de Monfil manejan los datos.
---

:::note
Esta traducción es un borrador automático. Si hay diferencias, el texto en inglés es la referencia. Consulta la [versión en inglés](../../../user-guide/privacy/).
:::

Última actualización: 23 de noviembre de 2026.

## Sitio web de la documentación

Este sitio usa [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) para medir las visitas y el rendimiento de carga de las páginas. Los mantenedores de Monfil usan estas estadísticas para mejorar la documentación y encontrar las páginas lentas.

Los informes de analítica incluyen las rutas de las páginas, los sitios de referencia, el país, el navegador, el sistema operativo, el tipo de dispositivo y los tiempos de carga. Tu navegador carga un script de Cloudflare y envía las mediciones a Cloudflare. Cloudflare recibe tu dirección IP cuando tu navegador hace estas solicitudes. Sus informes de analítica no dan a los mantenedores tu dirección IP.

Cloudflare indica que Web Analytics no usa cookies ni almacenamiento local para recopilar métricas de uso, y que no identifica a los visitantes mediante huellas digitales. No rastrea a los visitantes entre sitios web. Para más detalles, consulta su [documentación sobre recopilación de datos](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/).

Cloudflare conserva los datos de analítica sin muestrear durante siete días, y luego usa datos muestreados para estadísticas a más largo plazo. El panel da acceso a los seis meses anteriores. Consulta las [preguntas frecuentes de Web Analytics](https://developers.cloudflare.com/web-analytics/faq/) para ver sus periodos de muestreo y de acceso a los informes.

Cloudflare, Inc. tiene su sede en Estados Unidos. Su [política de privacidad](https://www.cloudflare.com/privacypolicy/) explica cómo maneja los datos de las solicitudes, cuánto tiempo conserva los datos personales y las garantías que usa para las transferencias fuera del Espacio Económico Europeo.

### Alojamiento del sitio y almacenamiento del navegador

Cloudflare aloja este sitio. Cloudflare recibe tu dirección IP y los detalles de la solicitud cuando abres una página. Consulta la [política de privacidad de Cloudflare](https://www.cloudflare.com/privacypolicy/).

El sitio guarda el tema de color que elegiste en el almacenamiento local de tu navegador. Esta configuración permanece en tu dispositivo hasta que la cambies o borres los datos guardados del sitio. Es independiente de la analítica de Cloudflare.

Puedes bloquear el script de Cloudflare con tu navegador o con un bloqueador de contenido, y seguir leyendo la documentación.

### Preguntas sobre privacidad y derechos

El mantenedor del sitio web de Monfil es responsable de este sitio. Para preguntas o solicitudes sobre tus datos personales, escribe a [hello@monfil.app](mailto:hello@monfil.app).

## Aplicación de escritorio

Monfil es un lector de fuentes RSS que se instala en tu equipo. No tiene cuenta ni servidor de Monfil. Guarda tus fuentes, artículos guardados y estado de lectura en tu dispositivo. Algunas configuraciones de visualización usan almacenamiento local. Puedes buscar y hacer una copia de seguridad de la base de datos en Configuración.

### Estadísticas de uso anónimas e informes de errores (opcional)

Monfil puede enviar estadísticas de uso anónimas e informes de errores. Un solo ajuste controla ambos. Ambos están desactivados hasta que aceptes. La primera vez que abres Monfil, muestra una tarjeta con dos botones iguales, **Compartir estadísticas e informes** y **No, gracias**. Si rechazas o cierras la tarjeta, Monfil vuelve a preguntar a los 30 días y después cada 30 días hasta que aceptes. Puedes cambiar tu elección en cualquier momento en **Configuración > Privacidad**. **Ver qué se envía** muestra el resumen que Monfil enviaría hoy y un ejemplo de informe de error.

#### Estadísticas de uso

Si das tu consentimiento, Monfil cuenta en tu dispositivo lo que haces. Una vez al día envía un evento `daily_summary` por cada día que usaste la aplicación. Cuando das tu consentimiento, también envía un evento `consent_granted` sin datos. El evento `daily_summary` contiene:

- Recuentos del día: artículos abiertos, extracciones de texto completo, fuentes añadidas, fuentes eliminadas, actualizaciones manuales, elementos guardados, feedpacks instalados, archivos OPML importados, archivos OPML exportados, copias de seguridad realizadas, workspaces creados, cambios de workspace, búsquedas y incrustaciones cargadas.
- Recuentos de fallos del día: fallos al actualizar fuentes, fallos al extraer artículos, fallos de solicitudes internas y fallos de la interfaz. Son solo números. No llevan texto de error.  Los fallos de actualización de fuentes también se cuentan por causa: tiempo de espera, HTTP 4xx, HTTP 5xx, TLS, DNS, análisis o tamaño excesivo.
- Cómo arrancó la app: si arrancó y en qué rango de tiempo mostró los primeros artículos (menos de 1 segundo, de 1 a 3 segundos, de 3 a 10 segundos o más de 10 segundos).
- Cómo fue añadir una fuente: el número de intentos y de éxitos, y el número de fallos por causa: no se encontró ninguna fuente, red, análisis o formato no admitido.
- El estado de tu biblioteca: un rango de tamaño para tus fuentes (`0`, `1-5`, `6-20`, `21-100` o `100+`), el número de workspaces, el número de carpetas y los tipos de fuente que usas, como `rss+youtube`.
- Tus configuraciones de visualización: densidad, tema, idioma de la interfaz de Monfil, si los elementos leídos están ocultos, si los elementos se marcan como leídos al desplazarte, si los enlaces se abren en tu navegador y si la navegación con el teclado está activada.
- El día que cubre, la versión de Monfil, tu sistema operativo y su versión, tu idioma y la versión del motor web de Monfil.

El evento nunca contiene un nombre de fuente, un enlace, el texto de un artículo, el texto de una búsqueda ni un nombre tuyo. Monfil no envía ningún identificador duradero. Cada solicitud usa un ID de sesión aleatorio nuevo.

[Aptabase](https://aptabase.com) recibe los eventos. Technov Solutions SRL, una empresa con sede en Bucarest, Rumanía, opera Aptabase. Actúa como encargado del tratamiento para el mantenedor de Monfil según su [acuerdo de tratamiento de datos](https://aptabase.com/legal/dpa). Monfil usa la región de la UE (`eu.aptabase.com`). Aptabase indica que procesa y almacena los datos de las cuentas de la región UE solo dentro de la Unión Europea.

Aptabase deriva en su servidor un ID de usuario anónimo como un hash de tu dirección IP y tu agente de usuario con una sal. Aptabase indica que la sal es diferente para cada aplicación y que se descarta cada 24 horas. El ID cambia cada día, así que el mantenedor no puede seguir a una persona de un día al siguiente. Aptabase indica que conserva los datos de analítica hasta por 5 años. Para más detalles, consulta la [política de privacidad de Aptabase](https://aptabase.com/legal/privacy).

#### Informes de errores

Si aceptas, Monfil envía un informe cuando algo falla, por ejemplo un error en la app, una actualización fallida, una recuperación de la base de datos o un cierre inesperado. Un informe contiene:

- El tipo de error, el mensaje de error y la traza de pila, que enumera lugares del código de Monfil.
- Un identificador de incidente corto, el mismo que muestra la pantalla de error, y la parte de la app que falló, por ejemplo el nombre de una solicitud interna.
- Un breve rastro de los últimos eventos de Monfil antes del fallo. Contiene nombres de eventos y valores fijos, como `outcome: failed`. Nunca contiene el nombre de una fuente, un enlace ni el identificador de una fuente o de un artículo.
- La versión de Monfil, si la compilación viene de GitHub o de una tienda, tu sistema operativo y su versión, el tipo de procesador y las versiones del motor web y de Node.js que incluye Monfil.
- Datos de sesión que indican cuántas sesiones terminan sin cierre inesperado: cuándo empezó la sesión, cuánto duró y si terminó bien.

Antes de enviar un informe, Monfil elimina del texto del error las rutas de archivos (tu carpeta personal pasa a ser `~`), los enlaces y las direcciones de correo. Solo envía los campos de la lista anterior y descarta el resto. Un informe no contiene nombres de fuentes, enlaces, texto de artículos, texto de búsqueda, nombre de usuario ni una dirección IP que añada Monfil. **Ver qué se envía** muestra un informe de ejemplo que Monfil crea en tu dispositivo a partir de un fallo inventado.

Si Monfil se cierra de forma inesperada a bajo nivel, también envía un volcado de memoria. Un volcado es una instantánea de la memoria del proceso que falló. La memoria puede contener fragmentos de lo que mostraba la app, como el título de un artículo. Monfil no puede eliminarlos.

Después de un fallo, puedes añadir detalles al informe. El comentario es opcional y lo escribes tú. El archivo de registro solo se adjunta si marcas **Adjuntar el archivo de registro**, y puedes ver una vista previa antes de enviarlo. El archivo de registro contiene los registros de eventos de Monfil, sin nombres de fuentes, enlaces completos, texto de artículos, credenciales ni rutas de archivos. Aun así, puede mostrar nombres de host de sitios y códigos de error. Monfil adjunta el último megabyte. La ventana de error nativa, que no tiene campo de texto, solo ofrece el archivo de registro.

[Sentry](https://sentry.io) recibe los informes. Functional Software, Inc., una empresa con sede en Estados Unidos, gestiona Sentry. Actúa como encargado del tratamiento del responsable de Monfil según su [acuerdo de tratamiento de datos](https://sentry.io/legal/dpa/). Monfil usa la región de la UE (`de.sentry.io`), donde Sentry almacena los datos en Alemania. Sentry recibe tu dirección IP con cada solicitud, y el proyecto de Monfil está configurado para no guardarla. Sentry conserva los informes de errores durante 30 días. El responsable recibe un correo cuando aparece un problema nuevo.

#### Tu elección

La base jurídica es tu consentimiento. Tu elección se guarda en tu dispositivo con su fecha y la versión de este aviso. Para retirarlo, desactiva **Compartir estadísticas de uso anónimas e informes de errores** en Configuración. Monfil deja entonces de contar y de enviar, y elimina los recuentos, los informes que esperan para enviarse y los volcados de memoria que guardaba en tu dispositivo. Los informes ya recibidos no se pueden vincular contigo, salvo que envíes al responsable el identificador de incidente de un informe. Para preguntar por tus datos, escribe a [hello@monfil.app](mailto:hello@monfil.app). Una compilación de Monfil sin clave de analítica y sin dirección de informes de errores, como una que compilas tú mismo, no envía nada.

### Solicitudes a otros sitios

Monfil pide las fuentes a sus editores cuando las actualiza. Al abrir un artículo, Monfil puede pedir la página del editor para obtener su texto completo. Las imágenes y los iconos de las fuentes pueden cargarse desde sitios remotos cuando aparecen en pantalla. Esos sitios reciben la solicitud y pueden ver información como tu dirección IP y los datos de tu aplicación o navegador.

Cuando añades una fuente, Monfil puede pedir la página que pegaste y las direcciones de fuente comunes del mismo sitio. Para un enlace de Hacker News, revisa las fuentes en [hnrss.org](https://hnrss.org). Para mostrar el icono de un proyecto de GitLab o de un perfil de Bluesky, pide el avatar a la API de GitLab o a la API pública de Bluesky. Una fuente de conferencias pide la lista de eventos a [developers.events](https://developers.events) cuando la añades y en cada actualización. GitHub Pages aloja esa lista.

Al abrir un artículo u otro enlace en tu navegador, también te conectas al sitio enlazado. Ese navegador usa sus propias configuraciones de privacidad.

### Contenido multimedia incrustado

Monfil admite incrustaciones de YouTube, X, Vimeo, Instagram y Spotify. Primero muestra una tarjeta. Monfil crea el marco incrustado del proveedor solo después de que hagas clic en **Cargar** en esa tarjeta. Cada incrustación necesita su propio clic cada vez que abres el artículo. Puedes leer el artículo sin cargar la incrustación.

Cuando cargas una incrustación, tu dispositivo se conecta con su proveedor. El proveedor recibe una solicitud para ese video, publicación o audio. Puede ver tu dirección IP y los datos de tu aplicación o navegador. Puede usar cookies u otro almacenamiento dentro de su marco. Monfil no controla las prácticas de datos del proveedor. El enlace **Abrir en** te conecta con el proveedor en tu navegador si haces clic en él.

Cargar una incrustación no impide que las imágenes ni los iconos del artículo se carguen desde sus propios sitios.

Políticas de privacidad de los proveedores: [YouTube (Google)](https://policies.google.com/privacy), [X](https://x.com/en/privacy), [Vimeo](https://vimeo.com/legal/privacy), [Instagram (Meta)](https://www.facebook.com/privacy/policy/) y [Spotify](https://www.spotify.com/legal/privacy-policy/).
