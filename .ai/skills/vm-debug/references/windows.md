# Windows guest

Use an elevated PowerShell window in the VM for server and firewall setup. Use a normal window for identity and network checks.

## Find the address and check SSH

Ask the operator to run the following in the guest terminal and to share the output:

```powershell
whoami
ipconfig
Get-Service sshd
Get-NetTCPConnection -LocalPort 22 -State Listen
Get-NetConnectionProfile | Format-List Name,NetworkCategory
Get-NetFirewallRule -Name OpenSSH-Server-In-TCP | Format-List Name,Enabled,Profile,Direction,Action
```

Use the current IPv4 address of the VMware network adapter. If OpenSSH Server is absent, ask the operator to install and start it in elevated PowerShell:

```powershell
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

Windows may classify the VMware network as `Public` while the default SSH firewall rule applies only to `Private`. If port 22 is listening but the Mac cannot connect, first compare the active profile with the rule. Where a firewall change is authorized, permit only the Mac's VMware network address:

```powershell
$MacHostIp = '<Mac address on the VMware network>'
New-NetFirewallRule -DisplayName 'SSH from Mac host' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 22 -Profile Public -RemoteAddress $MacHostIp
```

Get the Mac's VMware address from its network settings or the interface shown by `route -n get "$VM_HOST"` on the Mac. Do not use the VM's default gateway as a substitute for the Mac address. Check the rule again after a VM network change. A rule scoped to an old Mac address can stop working.

## Build and inspect

OpenSSH commonly starts `cmd.exe` for remote commands. In the VM, check the architecture with `echo %PROCESSOR_ARCHITECTURE%` in Command Prompt or `$env:PROCESSOR_ARCHITECTURE` in PowerShell. Install a matching Node.js runtime in the guest and confirm `node --version` and `npm --version`. If Node is absent, a portable Windows ZIP can be extracted for a temporary session; add its directory to that session's `PATH`.

In a guest terminal at the repository root:

```cmd
npm ci
npm run package
npx playwright test test/e2e/<file>.spec.ts
```

Run visual Playwright tests from a terminal in the Windows desktop. Use the VMware window to inspect native controls, menus, window chrome, scaling, and screenshots. SSH is useful for package output and logs but may run outside that desktop session.

If `better-sqlite3` fails during Electron Forge's native rebuild, inspect the guest architecture, included prebuilds, and build-tool error. Install the required Windows build tools or use a matching prebuild for a guest-only experiment. Verify database startup before trusting a build that skipped a rebuild.

Sources: [Microsoft OpenSSH setup](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse), [Microsoft OpenSSH server configuration](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-server-configuration).
