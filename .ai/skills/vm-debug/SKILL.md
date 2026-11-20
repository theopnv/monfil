---
name: vm-debug
description: Connect to local VMware Fusion Windows or Linux guests from a Mac to reproduce, inspect, build, and debug monfil platform bugs.
---

# Debug monfil in a VM

Use the Mac repository as the source of changes. Use SSH for guest commands, logs, and file transfer, and the VMware desktop for visual checks. Read [Windows setup](references/windows.md) or [Linux setup](references/linux.md) first, then use this page once SSH works.

## Connect from the Mac

The guest address can change after a reboot or a network change, so read it again each time. The user types the password in their own SSH prompt: never put it in a command, file, or chat. Check the host key fingerprint in the guest on first connection, and find out why before you replace a known host key that changed.

```sh
VM_USER='<guest account>'
VM_HOST='<current guest IPv4 address>'
nc -vz -G 3 "$VM_HOST" 22
ssh "$VM_USER@$VM_HOST"
```

For repeated commands with a password, ask the user to open one master connection in their terminal and share the socket path. The socket grants access while the master lives, so close it when you finish.

```sh
ssh -M -S "$VM_SOCKET" -fN "$VM_USER@$VM_HOST"
ssh -S "$VM_SOCKET" "$VM_USER@$VM_HOST" '<guest command>'
scp -o ControlPath="$VM_SOCKET" '<local file>' "$VM_USER@$VM_HOST:<guest-relative-path>"
ssh -S "$VM_SOCKET" -O exit "$VM_USER@$VM_HOST"
```

## Facts about this repository

- Playwright launches the build in `.vite/build`, not the source tree. Run `npm run package` on the guest after each source change, before `npx playwright test`.
- Run `npm ci` on the guest and check its CPU architecture first. Native modules and Electron need binaries for that OS and CPU, so never copy the Mac `node_modules`.
- A GUI run needs the guest's desktop session. An app or Playwright test started over SSH can fail without it, so start it from a terminal on the guest desktop and look at the window in VMware Fusion.
- On Windows OpenSSH the default remote shell is often `cmd.exe`. Call `powershell -NoProfile -Command "..."` when a command needs PowerShell.

## Reproduce and fix

1. Record the guest OS, CPU architecture, app version, exact actions, expected result, and actual result. Reproduce in the installed app first when the bug concerns an installer or a packaged app.
2. Find the code on the Mac worktree (`graft` when the index exists, `rg` otherwise). For a bug fix, write a failing regression test before you edit the app.
3. Put the same revision on the guest: clone it and check it out, or send `git diff --binary HEAD > vm-change.patch` with `scp` and run `git apply vm-change.patch` there. Copy new untracked files separately.
4. Use SSH for non-visual checks such as logs, `npm run lint`, packaging, and focused unit tests. Repeat the same reproduction steps after each change.
5. Keep the fix in the Mac repository. Treat guest-only build changes as experiments, and record them before you decide whether they belong in the repository.

Access to a VM is no permission to change its network policy or system packages during an unrelated task. Ask for the change when access is blocked, stop after the requested diagnosis or check, and close temporary connections.
