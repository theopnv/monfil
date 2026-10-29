---
title: Install Monfil
description: Download and install Monfil on macOS, Windows, or Linux.
---

Monfil is free. Pick your system:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

You need a Mac with Apple silicon (M1 or later) and macOS 13 Ventura or later. To check, open the Apple menu and select **About This Mac**. The **Chip** line must start with **Apple**.

1. Download [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg) from the latest release.
2. Open the downloaded file. A window with the Monfil icon and an Applications folder appears.
3. Drag the Monfil icon onto the Applications folder.
4. Close the window, then eject the Monfil disk in the Finder sidebar.
5. Open Monfil from your Applications folder or from Launchpad.

Apple checked this version of Monfil, so macOS opens it without a security warning.

Monfil updates itself. When a new version is ready, a message with a **Restart** button appears. Select **Restart** to finish the update. Updates work only when you open Monfil from the Applications folder.

## Windows

Monfil works on Windows 10 and Windows 11.

### Microsoft Store (recommended)

1. Open [Monfil in the Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. Select **Get** or **Install**.
3. Open Monfil from the Start menu.

The Store keeps Monfil up to date.

You can also install the Store version from a terminal with winget:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### Setup file

Use this option if you cannot use the Microsoft Store.

1. Open the [latest Monfil release](https://github.com/theopnv/monfil/releases/latest).
2. Under **Assets**, download the file that ends in `Setup.exe`.
3. Open the downloaded file. Monfil installs and opens.

Windows may show **Windows protected your PC**, because this file has no paid signature. Select **More info**, then **Run anyway**. The Store version does not show this message.

Monfil updates itself. When a new version is ready, a message with a **Restart** button appears. Select **Restart** to finish the update.

## Linux

Monfil works on 64-bit Intel and AMD computers.

1. Open the [latest Monfil release](https://github.com/theopnv/monfil/releases/latest).
2. Under **Assets**, download the file for your system:
    - On Debian, Ubuntu, or Linux Mint, the file that ends in `.deb`.
    - On Fedora, RHEL, or openSUSE, the file that ends in `.rpm`.
3. Open the downloaded file with your software center, or install it from a terminal in your Downloads folder:
    - On Debian, Ubuntu, or Linux Mint: `sudo apt install ./monfil_*.deb`
    - On Fedora or RHEL: `sudo dnf install ./monfil-*.rpm`
4. Open Monfil from your applications menu.

Monfil does not update itself on Linux. To update, download and install the new file from the latest release.

## Is Monfil safe?

The code of Monfil is public, and anyone can read it. GitHub builds each release from that code with a [public workflow](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## Next step

Follow [Use Monfil](../home/) to add feeds and set up a workspace.
