---
title: 安装 Monfil
description: 在 macOS、Windows 或 Linux 上下载并安装 Monfil。
---

Monfil 免费。请选择你的系统：

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

你需要 macOS 13 Ventura 或更高版本。要查看你的 Mac 使用的芯片，请打开苹果菜单并选择 **关于本机**。查看 **芯片** 或 **处理器** 那一行。

1. 从最新版本下载适用于你芯片的文件：
   - Apple 芯片（该行以 **Apple** 开头）：[`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel 芯片（该行以 **Intel** 开头）：[`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. 打开下载的文件。此时会出现一个窗口，其中有 Monfil 图标和“应用程序”文件夹。
3. 将 Monfil 图标拖到“应用程序”文件夹上。
4. 关闭窗口，然后在访达边栏中推出 Monfil 磁盘。
5. 从“应用程序”文件夹或 Launchpad 打开 Monfil。

Apple 已检查过此版本的 Monfil，因此 macOS 打开它时不会显示安全警告。

Monfil 会自动更新。新版本准备好后，会出现一条带有 **重新启动** 按钮的消息。选择 **重新启动**，即可完成更新。只有从“应用程序”文件夹打开 Monfil 时，才能自动更新。

## Windows

Monfil 可在 Windows 10 和 Windows 11 上运行。

### Microsoft Store（推荐）

1. 在 [Microsoft Store 中打开 Monfil](https://apps.microsoft.com/detail/9P4FZNFBR29Q)。
2. 选择 **获取** 或 **安装**。
3. 从开始菜单打开 Monfil。

Store 会让 Monfil 保持最新。

你也可以使用 winget 在终端中安装 Store 版本：

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### 安装文件

如果你无法使用 Microsoft Store，请使用此选项。

1. 打开[最新的 Monfil 版本](https://github.com/theopnv/monfil/releases/latest)。
2. 在 **资产** 下，下载以 `Setup.exe` 结尾的文件。
3. 打开下载的文件。Monfil 会安装并打开。

Windows 可能会显示 **Windows 已保护你的电脑**，因为此文件没有付费签名。选择 **更多信息**，然后选择 **仍要运行**。Store 版本不会显示此消息。

Monfil 会自动更新。新版本准备好后，会出现一条带有 **重新启动** 按钮的消息。选择 **重新启动**，即可完成更新。

## Linux

Monfil 可在 64 位 Intel 和 AMD 计算机上运行。

1. 打开[最新的 Monfil 版本](https://github.com/theopnv/monfil/releases/latest)。
2. 在 **资产** 下，下载适用于你系统的文件：
    - 在 Debian、Ubuntu 或 Linux Mint 上，下载以 `.deb` 结尾的文件。
    - 在 Fedora、RHEL 或 openSUSE 上，下载以 `.rpm` 结尾的文件。
3. 使用软件中心打开下载的文件，或在“下载”文件夹中打开终端并安装：
    - 在 Debian、Ubuntu 或 Linux Mint 上：`sudo apt install ./monfil_*.deb`
    - 在 Fedora 或 RHEL 上：`sudo dnf install ./monfil-*.rpm`
4. 从应用程序菜单打开 Monfil。

Monfil 在 Linux 上不会自动更新。要更新，请从最新版本下载并安装新文件。

## Monfil 安全吗？

Monfil 的代码是公开的，任何人都可以阅读。GitHub 会根据该代码构建每个版本，并使用[公开工作流](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml)。

## 下一步

请按照[使用 Monfil](../home/) 添加订阅源并设置 Workspace。
