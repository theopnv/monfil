<p align="center">
  <img src="./src/renderer/styles/monfil-logo.svg" alt="Monfil logo" width="140">
</p>

<h1 align="center">Monfil</h1>

<p align="center">What if you could reclaim control over the algorithm and create your own news feed?</p>
<p align="center"><a href="https://github.com/theopnv/monfil/releases">Download Monfil</a> · <a href="./feedpacks/">Browse feed packs</a> · <a href="CONTRIBUTING.md">Contribute</a></p>

Monfil is an open-source desktop feed reader for engineers who want to follow the sources they choose—not whatever social-media algorithms decide to show them.

Start with curated feed packs for topics such as "General Tech announcements and trends". Or "DevSecOps", for info about CI/CD, test automation, testing frameworks and software-supply-chain security. Or submit your own!

"Mon fil" means "My feed" in french.

➡️ ["Hate “The Algorithm?” RSS Is One of the Tools You’ve Been Looking For"](https://www.eff.org/deeplinks/2026/06/hate-algorithm-rss-one-tools-youve-been-looking)

<p align="center">
  <img src="./doc/gallery/workspace1-light.png" width="49%" alt="Monfil workspace, light mode">
  <img src="./doc/gallery/workspace1-dark.png" width="49%" alt="Monfil workspace, dark mode">
</p>
<p align="center">
  <img src="./doc/gallery/reader.png" width="49%" alt="Monfil reader">
  <img src="./doc/gallery/home.png" width="49%" alt="Monfil home">
</p>

## Problem
Keeping up with software engineering is increasingly difficult.

Important information is scattered across blogs, release notes, changelogs, YouTube channels, GitHub repositories, and security advisories. Social networks make discovery easier, but their algorithms can narrow what you see.

Monfil gives you a transparent alternative: choose your sources, organize them into workspaces, and read them in one focused place.

## Solution

Monfil combines:

- A distraction-free desktop feed reader
- Feedpacks: curated source packs for specific technical fields
- RSS and YouTube support
- Workspaces, search and read/unread tracking
- Keyboard shortcuts
- OPML import/export support

## Install

1. Go to the [Releases page](https://github.com/theopnv/monfil/releases) and open the latest version.
2. Download the file that matches your OS:
   - **macOS (Apple Silicon)**: `monfil-darwin-arm64-<version>.zip`
   - **Windows**: `monfil-<version>.Setup.exe`
   - **Linux (Debian/Ubuntu)**: `monfil_<version>_amd64.deb`
   - **Linux (Fedora/RHEL)**: `monfil-<version>-1.x86_64.rpm`
3. Install it like you would any other app for your OS.

### Why does my OS warn me about this app?

Monfil isn't code-signed. Signing costs money every year ($100/year for an Apple Developer account to sign macOS builds, and a paid certificate for Windows) and this is a free, one-person open source project, so that cost isn't covered. That means both macOS and Windows will flag monfil as coming from an "unidentified developer." This is a warning about the *lack of a paid signature*, not a sign that the app is unsafe: every line of monfil's code is public in this repository for anyone to read, and the [release build](.github/workflows/publish.yml) is produced straight from that source, in the open, by GitHub's own servers.

**macOS**: opening the app shows *"monfil.app is damaged and can't be opened."* This is Gatekeeper reacting to the missing signature, not an actually broken download. Open Terminal and run:

```bash
xattr -cr /Applications/monfil.app
```

(use the actual path if you didn't install it to `/Applications`). This clears the "downloaded from the internet" flag Gatekeeper is reacting to. Then open monfil as usual.

**Windows**: SmartScreen shows *"Windows protected your PC."* Click **More info**, then **Run anyway**. No terminal step needed, this is a one-time click per install.

**Linux**: no extra step. Install the `.deb` (`sudo apt install ./monfil_<version>_amd64.deb`) or the `.rpm` (`sudo rpm -i monfil-<version>-1.x86_64.rpm`) directly.

## Usage

- Add a feed with the '+' button at the top of the sidebar, or the "Add your first feed" button on an empty Home.
- Paste a link to an RSS feed, a YouTube channel, a handle, or a video. Monfil resolves what it points to.
- Put it in a folder, existing or new, then confirm.
- Create a folder with the folder icon next to '+' in the sidebar.
- Create a workspace with the '+' button in the left rail. Each workspace keeps its sources and river separate.
- Open the feedpack browser from the new-workspace dialog, an empty workspace, or the feed sidebar.
- Import an OPML file to create a workspace, add it to Home, or add its sources to the current workspace.
- Right-click a workspace to export it as OPML.
- Right-click a folder to rename or delete it. Deleting one asks where to move its feeds first, unless it's already empty.
- Drag a feed onto a folder to move it there.
- Remove a feed with a right-click on it in the sidebar.
- Click an item to open it in the reader; use `j`/`k`/`Esc` to move around without the mouse.
- Open Settings (gear icon) to change theme, density, refresh interval, and reading behavior.

## FAQ

**Why does this exist? Don't RSS readers already exist?**

- You choose the sources: No opaque recommendation algorithm decides what deserves your attention.
- Start with a pack: You do not need to spend hours discovering and configuring sources. Begin with a curated pack, then customize it.
- Focus on technical signals: Monfil is designed for following projects, tools, releases, changelogs, and security information, not general social content.
- Own your information diet: Monfil is open source and built around transparency, portability, and control.

**Is my data private?**
Yes. Monfil has no account, no server, and no analytics. Everything — your feeds, your read state, your articles — lives in one SQLite file on your machine. Settings shows you exactly how big it is and can reveal it in Finder/Explorer.

**Is there a mobile app?**
Not currently. Monfil is a desktop app (macOS, Windows, Linux) built with Electron. There's no mobile version planned right now.

**Is monfil free?**
Yes, and it's [MIT-licensed](LICENSE) open source. No ads.

**How do I report a bug or request a feature?**
Open an issue on GitHub. Read [CONTRIBUTING.md](CONTRIBUTING.md) first if you're planning to send a pull request — small, focused PRs are easiest to review.
