---
title: Búsqueda y búsquedas guardadas
description: Busca en el flujo con frases, OR, exclusiones y título, y guarda una búsqueda como píldora encima del flujo.
---

El cuadro de búsqueda encima del flujo filtra los elementos del workspace actual. Funciona igual para todas las fuentes.

## Sintaxis de búsqueda

| Escribe | Monfil muestra |
| --- | --- |
| `rust async` | Elementos que contienen ambas palabras |
| `"machine learning"` | Elementos que contienen la frase exacta |
| `kubernetes OR k8s` | Elementos que contienen cualquiera de las dos palabras. Escribe `OR` en mayúsculas. |
| `-sponsored` | Elementos sin la palabra. También funciona con una frase: `-"press release"`. |
| `title:release` | Elementos con la palabra en el título. También funciona con una frase: `title:"release notes"`. |

Puedes combinar las formas: `title:"release notes" -beta`. Una cadena como `go OR rust OR zig` funciona. Los corchetes no funcionan, y una palabra con `-` no puede formar parte de un `OR`. Un guion dentro de una palabra, como en `front-end`, forma parte de la palabra.

Una palabra de tres letras o menos, como `ci`, coincide solo con palabras completas, así que no encuentra `producing`. Cualquier otra palabra también coincide dentro de palabras más largas, así que `engineer` encuentra `engineers`. Escribe una palabra corta entre comillas, como `"ci"`, para que también coincida dentro de otras palabras.

Sin `title:`, Monfil busca en el título, en los primeros 200 caracteres del texto y en el nombre de la fuente. En una oferta de empleo, también busca en el lugar y en la modalidad de trabajo. No busca en el texto completo de un elemento.

## Guardar una búsqueda

1. Escribe una búsqueda. Aparece un botón **Guardar búsqueda** junto al cuadro de búsqueda.
2. Selecciona **Guardar búsqueda**, escribe un nombre y pulsa Enter.

La búsqueda ahora es una píldora encima del flujo. El número de la píldora es la cantidad de elementos no leídos que coinciden. Las píldoras pertenecen al workspace donde las creaste.

- Selecciona una píldora para ejecutar su búsqueda. Selecciónala de nuevo para borrar la búsqueda.
- Una píldora muestra elementos leídos y no leídos, así que un elemento se queda en su búsqueda en los días posteriores a la lectura. Selecciona **No leídos** para volver a ocultar los elementos leídos.
- Apunta a una píldora y selecciona la cruz para eliminarla.
- Haz clic derecho en una píldora, o enfócala y pulsa F2, para cambiarle el nombre.
- Si cambias la búsqueda de una píldora seleccionada, **Actualizar** cambia la píldora. **Guardar como nueva** crea una segunda píldora.
- Cuando hay más píldoras de las que la fila puede mostrar, desplaza la fila hacia los lados o selecciona el menú de tres puntos para verlas todas.
