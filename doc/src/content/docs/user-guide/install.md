---
title: Install Monfil
description: Download Monfil for macOS, Windows, or Linux.
---

On Windows, get Monfil from the [Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q). The Store installs Monfil with no security warning and keeps it up to date.

To install the Store version from a terminal, run this command:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

The Store updates this copy automatically. To update it yourself, run `winget upgrade --id 9P4FZNFBR29Q`.

For macOS, Linux, or the Windows setup file:

1. Open the [Monfil releases](https://github.com/theopnv/monfil/releases) and select the latest release.
2. Download the file for your system:
    - Choose the DMG for macOS
    - Choose the setup file for Windows
    - Choose the DEB package for Debian or Ubuntu
    - Choose the RPM package for Fedora or RHEL
3. Install it with your system's usual installer. On macOS, open the DMG and drag Monfil to the Applications folder.

The macOS app and the Windows setup file install a copy of Monfil that updates itself. On macOS, open Monfil from the Applications folder, not from the DMG, so that it can update. When an update is ready, Monfil shows a message with a **Restart** button.

## System warnings

The macOS app is signed with an Apple Developer ID and notarized by Apple, so macOS opens it without a warning.

The Windows setup file isn't code-signed. Windows flags it as coming from an "unidentified developer." This is a warning about the *lack of a paid signature*, not a sign that the app is unsafe: every line of monfil's code is public in this repository for anyone to read, and the [release build](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml) is produced straight from that source, in the open, by GitHub's own servers.

The Microsoft Store version does not show this warning. If you use the Windows setup file, SmartScreen may show **Windows protected your PC**. Select **More info**, then **Run anyway**.

On Linux, install the package with your package manager. From the folder that holds one Monfil DEB file, run this command on Debian or Ubuntu:

```sh
sudo apt install ./monfil_*.deb
```

For Fedora or RHEL, run this command from the folder that holds one Monfil RPM file:

```sh
sudo rpm -i ./monfil-*.rpm
```

After installation, follow [Use Monfil](../home/) to add feeds and set up a workspace.
