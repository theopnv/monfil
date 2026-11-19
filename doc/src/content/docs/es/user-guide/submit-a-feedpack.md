---
title: Enviar un feedpack
description: Comparte una colección de fuentes con otros lectores de Monfil.
---

Un feedpack es una colección de fuentes sobre un tema. Puedes crear uno en Monfil y proponerlo para el catálogo de feedpacks. Necesitas una cuenta de GitHub para enviarlo, pero puedes usar el sitio web de GitHub para todos los pasos.

Enviarás un archivo OPML con las fuentes y actualizarás `feedpacks/index.json` para describir el pack. Un pull request pide al mantenedor de Monfil que revise esos cambios. Tu pack aparece en el catálogo después de aceptarse.

## 1. Crear el pack en Monfil

1. Selecciona **+** en la barra izquierda para crear un workspace para el tema. Usa **+** en la parte superior de la barra de fuentes para añadir las fuentes que quieres compartir. Ponlas en carpetas útiles.
2. Abre cada fuente. Comprueba que publica contenido y que encaja con el tema. Quita los duplicados y las fuentes rotas.
3. Haz clic derecho sobre el icono del workspace en la barra izquierda y selecciona **Exportar como OPML**.
4. Guarda el archivo con un nombre corto formado por palabras en minúsculas unidas con guiones, como `web-performance.opml`.

OPML es el formato de archivo que Monfil usa para mover una lista de fuentes y carpetas entre aplicaciones. La exportación guarda las fuentes de ese workspace.

## 2. Hacer una copia del proyecto en GitHub

1. [Crea una cuenta de GitHub](https://github.com/signup) si no tienes una. Inicia sesión y abre el [repositorio de Monfil](https://github.com/theopnv/monfil).
2. Selecciona **Fork**, luego **Create fork**. GitHub crea una copia con tu cuenta. La [guía de forks de GitHub](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) muestra imágenes de estos botones.
3. En tu fork, abre el menú de ramas encima de la lista de archivos. Al principio muestra **main**. Escribe un nombre como `add-web-performance-pack`, luego selecciona **Create branch**. Una rama guarda los cambios que quieres enviar. Mantenla seleccionada para los dos cambios de archivo.

## 3. Subir el archivo OPML

1. En tu fork, abre la carpeta `feedpacks`.
2. Selecciona **Add file**, luego **Upload files**. Elige el archivo OPML que exportaste.
3. Guarda el cambio en la rama que creaste. GitHub puede mostrar el botón como **Commit changes** o **Propose changes**. Un commit guarda un cambio en tu copia.

## 4. Describir el pack en el catálogo

1. Quédate en tu fork y en la misma rama. Abre `feedpacks/index.json` y selecciona el icono de lápiz para editarlo.
2. Añade un objeto dentro de la lista `packs`. Pon una coma entre tu objeto y el anterior. Usa este ejemplo como guía:

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

Reemplaza los valores del ejemplo por los tuyos. Haz que `slug` sea único entre los packs existentes, y que `opml` coincida exactamente con el nombre de tu archivo. `sourceCount` es el número de fuentes, sin contar las carpetas. Pon en `updatedAt` la fecha en que revisaste las fuentes por última vez, en formato `YYYY-MM-DD`. Usa una descripción corta y algunas etiquetas de búsqueda en minúsculas. Mantén el valor `version` de la raíz tal como está.

Guarda este cambio en la misma rama que el archivo OPML.

## 5. Pedir una revisión

1. Vuelve al [repositorio original de Monfil](https://github.com/theopnv/monfil). Selecciona **Pull requests**, luego **New pull request**.
2. Selecciona **compare across forks**. Pon el repositorio base en `theopnv/monfil` y la rama base en `main`. Pon **head fork** en tu copia y **compare branch** en la rama que creaste. La [guía de pull requests de GitHub](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork) muestra esta pantalla.
3. Revisa **Files changed**. Debe mostrar tu archivo OPML y tu edición de `feedpacks/index.json`.
4. Pon un título claro a la solicitud. En la descripción, indica qué cubre el pack, cómo elegiste las fuentes y si alguna fuente necesita contexto. Selecciona **Create pull request**.

GitHub ejecuta una comprobación que verifica que el archivo OPML existe y que `sourceCount` coincide con sus fuentes. El mantenedor revisa las fuentes, su encaje con el tema y los detalles del catálogo. Puedes responder preguntas en el pull request y actualizar la misma rama si hacen falta cambios.

Antes de aceptar el pack, debes firmar el [Acuerdo de Licencia de Colaborador](https://github.com/theopnv/monfil/blob/main/CLA.md). CLA Assistant añade un enlace a tu pull request. Sigue ese enlace para firmar.

## Si haces el archivo OPML tú mismo

Usa OPML 2.0. Pon cada carpeta en un `<outline>` y cada fuente dentro de su carpeta. Cada fuente necesita un título, un `type` compatible y un `xmlUrl`. Puedes usar un [feedpack existente](https://github.com/theopnv/monfil/tree/main/feedpacks) como ejemplo.

Si trabajas en el proyecto de forma local, ejecuta `npm install` y luego `npm run check:feedpacks` antes de enviar. Ese comando comprueba los nombres de archivo del catálogo y el número de fuentes. Abre las fuentes tú mismo para comprobar que sus URL funcionan y que el contenido encaja con tu pack.
