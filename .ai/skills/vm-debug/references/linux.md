# Linux guest

These setup commands target an Ubuntu guest. Use the distribution's package manager and service name for another Linux guest.

## Find the address and check SSH

Ask the operator to run the following in the guest terminal and to share the output:

```sh
id -un
hostname -I
uname -m
systemctl status ssh
sudo ufw status verbose
```

Use the current IPv4 address on the VMware network. If the SSH server is absent, ask the operator to install and start it:

```sh
sudo apt update
sudo apt install openssh-server
sudo systemctl enable --now ssh
```

If UFW is active and blocks SSH, permit the Mac's VMware network address after the user authorizes the firewall change:

```sh
sudo ufw allow proto tcp from <Mac-host-IPv4> to any port 22
```

Get the Mac address from its network settings or the interface shown by `route -n get "$VM_HOST"` on the Mac. Check that the service listens with `ss -ltn '( sport = :22 )'`. Use `journalctl -u ssh` to inspect server errors.

## Build and inspect

Install a Node.js runtime that matches the guest CPU and the repository's requirements. In a guest terminal at the repository root:

```sh
node --version
npm --version
npm ci
npm run package
npx playwright test test/e2e/<file>.spec.ts
```

Use a terminal in the Linux desktop for GUI tests and for visual inspection in VMware Fusion. A remote SSH session may lack `DISPLAY`, `WAYLAND_DISPLAY`, or the desktop authorization needed to open Electron. For a headless test, use the project's Playwright setup only when its checks do not depend on the visible native window.

Sources: [Ubuntu firewall commands](https://documentation.ubuntu.com/server/how-to/security/firewalls/), [Ubuntu OpenSSH release notes](https://documentation.ubuntu.com/release-notes/26.04/summary-for-lts-users/).
