---
title: Monfilをインストールする
description: macOS、Windows、Linux に Monfil をダウンロードしてインストールします。
---

Monfilは無料です。お使いのOSを選んでください:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

macOS 13 Ventura 以降が必要です。Mac のチップを確認するには、Apple メニューを開き、**このMacについて** を選択します。**チップ** または **プロセッサ** の行を見てください。

1. 最新のリリースから、お使いのチップ用のファイルをダウンロードします:
   - Apple シリコン（行が **Apple** で始まる）: [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel（行が **Intel** で始まる）: [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. ダウンロードしたファイルを開きます。Monfilのアイコンと Applications フォルダが表示されたウィンドウが開きます。
3. Monfilのアイコンを Applications フォルダにドラッグします。
4. ウィンドウを閉じてから、Finder のサイドバーで Monfil のディスクを取り出します。
5. Applications フォルダまたは Launchpad から Monfil を開きます。

Apple がこのバージョンのMonfilを確認済みのため、macOS は警告を表示せずに開きます。

Monfilは自動で更新されます。新しいバージョンの準備ができると、**再起動** ボタンが表示されたメッセージが出ます。**再起動** を選択すると、更新が完了します。更新は、Applications フォルダから Monfil を開いた場合にのみ機能します。

## Windows

Monfilは Windows 10 と Windows 11 で動作します。

### Microsoft Store（推奨）

1. [Microsoft Store のMonfil](https://apps.microsoft.com/detail/9P4FZNFBR29Q) を開きます。
2. **入手** または **インストール** を選択します。
3. スタートメニューから Monfil を開きます。

Store が Monfil を最新の状態に保ちます。

winget を使って、ターミナルから Store 版をインストールすることもできます:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### セットアップファイル

Microsoft Store を使えない場合は、このオプションを使います。

1. [最新のMonfilリリース](https://github.com/theopnv/monfil/releases/latest) を開きます。
2. **アセット** の下で、`Setup.exe` で終わるファイルをダウンロードします。
3. ダウンロードしたファイルを開きます。Monfilがインストールされ、開きます。

このファイルには有料の署名がないため、Windows が **Windows によって PC が保護されました** と表示する場合があります。**詳細情報** を選択してから、**実行** を選択します。Store 版では、このメッセージは表示されません。

Monfilは自動で更新されます。新しいバージョンの準備ができると、**再起動** ボタンが表示されたメッセージが出ます。**再起動** を選択すると、更新が完了します。

## Linux

Monfilは 64 ビットの Intel および AMD 製のコンピューターで動作します。

1. [最新のMonfilリリース](https://github.com/theopnv/monfil/releases/latest) を開きます。
2. **アセット** の下で、お使いの環境に合ったファイルをダウンロードします:
    - Debian、Ubuntu、Linux Mint では、`.deb` で終わるファイル。
    - Fedora、RHEL、openSUSE では、`.rpm` で終わるファイル。
3. ダウンロードしたファイルをソフトウェアセンターで開くか、ダウンロードフォルダーからターミナルでインストールします:
    - Debian、Ubuntu、Linux Mint: `sudo apt install ./monfil_*.deb`
    - Fedora または RHEL: `sudo dnf install ./monfil-*.rpm`
4. アプリケーションメニューから Monfil を開きます。

Linux では、Monfilは自動で更新されません。更新するには、最新のリリースから新しいファイルをダウンロードしてインストールします。

## Monfilは安全ですか？

Monfilのコードは公開されており、誰でも読めます。GitHub は、そのコードから各リリースを[公開ワークフロー](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml)でビルドします。

## 次の手順

[Monfilの使い方](../home/) に従って、フィードを追加し、ワークスペースを設定してください。
