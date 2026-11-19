---
title: Instalar Monfil
description: Descarga e instala Monfil en macOS, Windows o Linux.
---

Monfil es gratis. Elige tu sistema:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

Necesitas macOS 13 Ventura o una versión posterior. Para ver qué chip tiene tu Mac, abre el menú Apple y selecciona **Acerca de este Mac**. Mira la línea **Chip** o **Procesador**.

1. Descarga el archivo para tu chip desde la última versión:
   - Apple silicon (la línea empieza con **Apple**): [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel (la línea empieza con **Intel**): [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. Abre el archivo descargado. Aparece una ventana con el icono de Monfil y una carpeta Aplicaciones.
3. Arrastra el icono de Monfil sobre la carpeta Aplicaciones.
4. Cierra la ventana y expulsa el disco de Monfil en la barra lateral del Finder.
5. Abre Monfil desde tu carpeta Aplicaciones o desde Launchpad.

Apple revisó esta versión de Monfil, así que macOS la abre sin advertencia de seguridad.

Monfil se actualiza solo. Cuando una versión nueva está lista, aparece un mensaje con un botón **Reiniciar**. Selecciona **Reiniciar** para terminar la actualización. Las actualizaciones solo funcionan si abres Monfil desde la carpeta Aplicaciones.

## Windows

Monfil funciona en Windows 10 y Windows 11.

### Microsoft Store (recomendado)

1. Abre [Monfil en Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. Selecciona **Obtener** o **Instalar**.
3. Abre Monfil desde el menú Inicio.

La Store mantiene Monfil actualizado.

También puedes instalar la versión de la Store desde una terminal con winget:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### Archivo de instalación

Usa esta opción si no puedes usar Microsoft Store.

1. Abre la [última versión de Monfil](https://github.com/theopnv/monfil/releases/latest).
2. En **Recursos**, descarga el archivo que termina en `Setup.exe`.
3. Abre el archivo descargado. Monfil se instala y se abre.

Windows puede mostrar **Windows protegió tu PC**, porque este archivo no tiene una firma de pago. Selecciona **Más información** y luego **Ejecutar de todas formas**. La versión de la Store no muestra este mensaje.

Monfil se actualiza solo. Cuando una versión nueva está lista, aparece un mensaje con un botón **Reiniciar**. Selecciona **Reiniciar** para terminar la actualización.

## Linux

Monfil funciona en computadoras de 64 bits con procesadores Intel y AMD.

1. Abre la [última versión de Monfil](https://github.com/theopnv/monfil/releases/latest).
2. En **Recursos**, descarga el archivo para tu sistema:
    - En Debian, Ubuntu o Linux Mint, el archivo que termina en `.deb`.
    - En Fedora, RHEL u openSUSE, el archivo que termina en `.rpm`.
3. Abre el archivo descargado con tu centro de software, o instálalo desde una terminal en tu carpeta de descargas:
    - En Debian, Ubuntu o Linux Mint: `sudo apt install ./monfil_*.deb`
    - En Fedora o RHEL: `sudo dnf install ./monfil-*.rpm`
4. Abre Monfil desde tu menú de aplicaciones.

Monfil no se actualiza solo en Linux. Para actualizar, descarga e instala el archivo nuevo de la última versión.

## ¿Es segura Monfil?

El código de Monfil es público, y cualquiera puede leerlo. GitHub compila cada versión a partir de ese código con un [flujo de trabajo público](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## Siguiente paso

Sigue [Usar Monfil](../home/) para añadir fuentes y preparar un workspace.
