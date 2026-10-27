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
    - Choose the ZIP for macOS
    - Choose the setup file for Windows
    - Choose the DEB package for Debian or Ubuntu
    - Choose the RPM package for Fedora or RHEL
3. Install it with your system's usual installer.

The Windows setup file installs a copy of Monfil that updates itself. When an update is ready, Monfil shows a message with a **Restart** button.

## System warnings

Monfil isn't code-signed. Signing costs money every year ($100/year for an Apple Developer account to sign macOS builds, and a paid certificate for Windows) and this is a free, one-person project, so that cost isn't covered.

That means both macOS and Windows will flag monfil as coming from an "unidentified developer." This is a warning about the *lack of a paid signature*, not a sign that the app is unsafe: every line of monfil's code is public in this repository for anyone to read, and the [release build](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml) is produced straight from that source, in the open, by GitHub's own servers.

On macOS, the warning may say that `monfil.app` is damaged. Put the app in your Applications folder. Open Terminal in that folder and run:

```sh
xattr -cr monfil.app
```

Then open the app again.

The Microsoft Store version does not show these warnings. If you use the Windows setup file, SmartScreen may show **Windows protected your PC**. Select **More info**, then **Run anyway**.

On Linux, install the package with your package manager. From the folder that holds one Monfil DEB file, run this command on Debian or Ubuntu:

```sh
sudo apt install ./monfil_*.deb
```

For Fedora or RHEL, run this command from the folder that holds one Monfil RPM file:

```sh
sudo rpm -i ./monfil-*.rpm
```

After installation, follow [Use Monfil](../home/) to add feeds and set up a workspace.
