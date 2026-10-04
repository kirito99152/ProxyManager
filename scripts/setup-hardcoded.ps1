# ProxyManager Local Setup Script
# Run this script as Administrator from the extracted folder.

$InstallDir = "C:\ProxyManager"
$ServiceName = "ProxyManagerAgent"
# We'll use the domain name for the server address
$ServerAddr = "59.153.245.146:50051"

# 1. Check for Admin rights
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Please run this script as Administrator!"
    exit
}

# 2. Create directory and copy files
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir
}

Write-Host "Copying files to $InstallDir..."
Copy-Item -Path "agent.exe", "frpc.exe" -Destination $InstallDir -Force

if (Test-Path "recovery.hash") {
    Write-Host "Copying recovery.hash to $InstallDir..."
    Copy-Item -Path "recovery.hash" -Destination $InstallDir -Force
    try {
        icacls "$InstallDir\recovery.hash" /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" | Out-Null
    } catch {}
}

# 3. Setup Service for Auto-Start at Boot
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping and removing existing service..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host "Creating Windows Service..."
New-Service -Name $ServiceName `
            -BinaryPathName "`"$InstallDir\agent.exe`" -server `"$ServerAddr`"" `
            -DisplayName "ProxyManager Client Agent" `
            -StartupType Automatic `
            -Description "ProxyManager Client Agent - Tu dong khoi dong cung he thong va giam sat may chu." | Out-Null

# Configure automatic startup at boot (before login), network dependencies, and recovery actions
sc.exe config $ServiceName start= auto depend= Tcpip/Dnscache | Out-Null
sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/15000 | Out-Null
sc.exe failureflag $ServiceName 1 | Out-Null

Write-Host "Starting service..."
Start-Service -Name $ServiceName

Write-Host "-------------------------------------------"
Write-Host "Setup Completed Successfully!"
Write-Host "The agent is now installed and configured to auto-start with Windows at boot (no login required)."
Write-Host "-------------------------------------------"
pause
