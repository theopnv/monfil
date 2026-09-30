---
name: vm-debug
description: Connect to local VMware Fusion Windows or Linux guests from a Mac to reproduce, inspect, build, and debug monfil platform bugs.
---

# Debug monfil in a VM

Use the Mac repository as the source of changes. Use SSH for guest commands, logs, and file transfer. Use the VMware desktop for visual checks and for Electron tests that need a real graphical session. A remote SSH session can run in a different desktop session, especially on Windows.

Read [Windows setup](references/windows.md) for a Windows guest. Read [Linux setup](references/linux.md) for a Linux guest. Use the commands below after SSH works.

## Connect from the Mac

Get the guest's current address each time the VM network changes. VMware Fusion NAT and host-only networks let the Mac reach the guest. The guest address can change after a reboot or network change. Set these values in the Mac shell:

```sh
VM_USER='<guest account>'
VM_HOST='<current guest IPv4 address>'
nc -vz -G 3 "$VM_HOST" 22
ssh "$VM_USER@$VM_HOST"
```

The user enters the password in the local SSH prompt. Do not put a password in a command, file, or chat. On first connection, check the host key fingerprint in the guest before accepting it. If a known host key changes, check whether the VM was recreated or its address was reassigned before changing the local SSH record.

For repeated password-based commands, ask the user to open one SSH master connection in their Mac terminal and share the socket path:

```sh
VM_SOCKET="$(mktemp -d)/ssh.sock"
ssh -M -S "$VM_SOCKET" -fN "$VM_USER@$VM_HOST"
printf 'VM_SOCKET=%s\n' "$VM_SOCKET"
```

Then use the socket for subsequent commands and copies:

```sh
ssh -S "$VM_SOCKET" "$VM_USER@$VM_HOST" '<guest command>'
scp -o ControlPath="$VM_SOCKET" '<local file>' "$VM_USER@$VM_HOST:<guest-relative-path>"
ssh -S "$VM_SOCKET" -O check "$VM_USER@$VM_HOST"
```

If the socket has closed, ask the user to reconnect or use their normal SSH authentication. A shared socket grants access while its master connection lives. Close it when finished:

```sh
ssh -S "$VM_SOCKET" -O exit "$VM_USER@$VM_HOST"
```

## Reproduce and fix

1. Record the guest OS, CPU architecture, app version, exact actions, expected result, actual result, and any screenshot or log. Reproduce in the installed app first when the bug concerns an installer or packaged app.
2. Inspect the Mac worktree and use the repository's `graft` index before reading source. For a bug fix, write a failing regression test before editing the app.
3. Prepare the guest source. If Git is available there, clone the repository and check out the same revision as the Mac. For local tracked edits, create a patch with `git diff --binary HEAD > vm-change.patch`, copy it with `scp`, and apply it in the guest with `git apply vm-change.patch`. Copy new, untracked source files separately. If Git is unavailable, use a source archive plus `scp` for changed files. Never copy Mac `node_modules` into the guest.
4. Install dependencies in the guest with `npm ci`. Check the guest architecture first. Native modules and Electron need binaries for that guest OS and CPU. Build on the guest with `npm run package` after each source change before running Playwright. This repository's Playwright suite launches `.vite/build`, not the source tree.
5. Use SSH for nonvisual checks, such as logs, `npm run lint`, packaging, and focused unit tests. Start GUI-dependent Playwright tests or the app from a terminal in the guest desktop. Inspect the visible window in VMware Fusion. An SSH-launched GUI test can fail because it lacks the interactive desktop session.
6. After each change, send only the needed files or patch, rebuild in the guest, and repeat the same reproduction steps. Keep the fix in the Mac repository. Treat guest-only build changes as experiments and record them before deciding whether they belong in the repository.

Useful repository commands on either OS:

```sh
npm start
npm run lint
npm run package
npx vitest run <test-file>
npx playwright test <test-file>
```

The guest shell syntax differs by OS. On Windows OpenSSH, the default remote shell is often `cmd.exe`; call `powershell -NoProfile -Command "..."` when a remote command needs PowerShell. Keep an interactive guest terminal open for GUI runs.

Do not treat access to a VM as permission to alter its network policy or system packages during an unrelated task. Set up SSH when the user asks for VM access, or ask for the needed change when access is blocked. Stop after the requested diagnosis or verification and close temporary connections.
