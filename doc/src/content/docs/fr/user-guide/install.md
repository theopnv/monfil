---
title: Installer Monfil
description: Téléchargez et installez Monfil sur macOS, Windows ou Linux.
---

Monfil est gratuit. Choisissez votre système :

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

Il faut macOS 13 Ventura ou une version plus récente. Pour voir quelle puce votre Mac utilise, ouvrez le menu Apple et sélectionnez **À propos de ce Mac**. Regardez la ligne **Puce** ou **Processeur**.

1. Téléchargez le fichier pour votre puce depuis la dernière version :
   - Apple silicon (la ligne commence par **Apple**) : [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel (la ligne commence par **Intel**) : [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. Ouvrez le fichier téléchargé. Une fenêtre avec l'icône de Monfil et un dossier Applications apparaît.
3. Faites glisser l'icône de Monfil sur le dossier Applications.
4. Fermez la fenêtre, puis éjectez le disque Monfil dans la barre latérale du Finder.
5. Ouvrez Monfil depuis votre dossier Applications ou depuis Launchpad.

Apple a vérifié cette version de Monfil, donc macOS l'ouvre sans avertissement de sécurité.

Monfil se met à jour seul. Quand une nouvelle version est prête, un message avec un bouton **Redémarrer** apparaît. Sélectionnez **Redémarrer** pour terminer la mise à jour. Les mises à jour ne fonctionnent que si vous ouvrez Monfil depuis le dossier Applications.

## Windows

Monfil fonctionne sous Windows 10 et Windows 11.

### Microsoft Store (recommandé)

1. Ouvrez [Monfil dans le Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. Sélectionnez **Obtenir** ou **Installer**.
3. Ouvrez Monfil depuis le menu Démarrer.

Le Store maintient Monfil à jour.

Vous pouvez aussi installer la version du Store depuis un terminal avec winget :

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### Fichier d'installation

Utilisez cette option si vous ne pouvez pas utiliser le Microsoft Store.

1. Ouvrez la [dernière version de Monfil](https://github.com/theopnv/monfil/releases/latest).
2. Sous **Ressources**, téléchargez le fichier qui se termine par `Setup.exe`.
3. Ouvrez le fichier téléchargé. Monfil s'installe et s'ouvre.

Windows peut afficher **Windows a protégé votre PC**, car ce fichier n'a pas de signature payante. Sélectionnez **Informations complémentaires**, puis **Exécuter quand même**. La version du Store n'affiche pas ce message.

Monfil se met à jour seul. Quand une nouvelle version est prête, un message avec un bouton **Redémarrer** apparaît. Sélectionnez **Redémarrer** pour terminer la mise à jour.

## Linux

Monfil fonctionne sur les ordinateurs Intel et AMD 64 bits.

1. Ouvrez la [dernière version de Monfil](https://github.com/theopnv/monfil/releases/latest).
2. Sous **Ressources**, téléchargez le fichier pour votre système :
    - Sur Debian, Ubuntu ou Linux Mint, le fichier qui se termine par `.deb`.
    - Sur Fedora, RHEL ou openSUSE, le fichier qui se termine par `.rpm`.
3. Ouvrez le fichier téléchargé avec votre centre logiciel, ou installez-le depuis un terminal dans votre dossier Téléchargements :
    - Sur Debian, Ubuntu ou Linux Mint : `sudo apt install ./monfil_*.deb`
    - Sur Fedora ou RHEL : `sudo dnf install ./monfil-*.rpm`
4. Ouvrez Monfil depuis votre menu des applications.

Monfil ne se met pas à jour seul sous Linux. Pour le mettre à jour, téléchargez et installez le nouveau fichier de la dernière version.

## Monfil est-il sûr ?

Le code de Monfil est public, et chacun peut le lire. GitHub compile chaque version à partir de ce code avec un [workflow public](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## Étape suivante

Suivez [Utiliser Monfil](../home/) pour ajouter des flux et configurer un workspace.
