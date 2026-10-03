---
title: Install Monfil
description: Download Monfil for macOS, Windows, or Linux.
---

1. Open the [Monfil releases](https://github.com/theopnv/monfil/releases) and select the latest release.
2. Download the file for your system:
    - Choose the ZIP for macOS
    - Choose the setup file for Windows
    - Choose the DEB package for Debian or Ubuntu
    - Choose the RPM package for Fedora or RHEL
3. Install it with your system's usual installer.

## System warnings

Monfil isn't code-signed. Signing costs money every year ($100/year for an Apple Developer account to sign macOS builds, and a paid certificate for Windows) and this is a free, one-person project, so that cost isn't covered.

That means both macOS and Windows will flag monfil as coming from an "unidentified developer." This is a warning about the *lack of a paid signature*, not a sign that the app is unsafe: every line of monfil's code is public in this repository for anyone to read, and the [release build](../../../../github/workflows/publish.yml) is produced straight from that source, in the open, by GitHub's own servers.

On macOS, the warning may say that `monfil.app` is damaged. Put the app in your Applications folder. Open Terminal in that folder and run:

```sh
xattr -cr monfil.app
```

Then open the app again.

On Windows, SmartScreen may show **Windows protected your PC**. Select **More info**, then **Run anyway**.

On Linux, install the package with your package manager. From the folder that holds one Monfil DEB file, run this command on Debian or Ubuntu:

```sh
sudo apt install ./monfil_*.deb
```

For Fedora or RHEL, run this command from the folder that holds one Monfil RPM file:

```sh
sudo rpm -i ./monfil-*.rpm
```

After installation, follow [Use Monfil](../home/) to add feeds and set up a workspace.
