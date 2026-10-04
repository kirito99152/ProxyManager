# ProxyManager Agent - Windows Install Script
# Usage: .\install-agent.ps1 -Server "59.153.245.146:50051"

param (
    [Parameter(Mandatory=$true)]
    [string]$Server,
    [Parameter(Mandatory=$false)]
    [string]$RecoveryHash = ""
)

$Version = "0.68.0"
$InstallDir = "C:\ProxyManager"
$DashboardUrl = "https://59.153.245.146"
$FrpUrl = "$DashboardUrl/downloads/frpc-windows-amd64.exe"

# 1. Create directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir
}

if (-not [string]::IsNullOrWhiteSpace($RecoveryHash)) {
    echo "Saving Emergency Recovery Hash..."
    Set-Content -Path "$InstallDir\recovery.hash" -Value $RecoveryHash -Force
    try {
        icacls "$InstallDir\recovery.hash" /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" | Out-Null
    } catch {}
}

Set-Location $InstallDir

echo "Adding Windows Defender exclusion for $InstallDir..."
Add-MpPreference -ExclusionPath $InstallDir -ErrorAction SilentlyContinue

echo "Downloading Agent for Windows from ProxyManager Server..."
Invoke-WebRequest -Uri "$DashboardUrl/downloads/agent-windows-amd64.exe" -OutFile "$InstallDir\agent.exe"

echo "Downloading FRPC v$Version from ProxyManager Server..."
Invoke-WebRequest -Uri $FrpUrl -OutFile "$InstallDir\frpc.exe"

echo "Setting up Windows Service for Auto-Start at Boot..."
# Remove old service if exists
$oldService = Get-Service -Name "ProxyManagerAgent" -ErrorAction SilentlyContinue
if ($oldService) {
    echo "Removing existing service..."
    Stop-Service -Name "ProxyManagerAgent" -Force -ErrorAction SilentlyContinue
    sc.exe delete "ProxyManagerAgent" | Out-Null
    Start-Sleep -Seconds 2
}

# Create new service with explicit arguments
New-Service -Name "ProxyManagerAgent" `
            -BinaryPathName "`"$InstallDir\agent.exe`" -server `"$Server`"" `
            -DisplayName "ProxyManager Client Agent" `
            -StartupType Automatic `
            -Description "ProxyManager Client Agent - Tu dong khoi dong cung he thong va giam sat may chu." | Out-Null

# Configure automatic startup at boot (LocalSystem, no login needed), network dependencies and failure recovery
sc.exe config "ProxyManagerAgent" start= auto depend= Tcpip/Dnscache | Out-Null
sc.exe failure "ProxyManagerAgent" reset= 86400 actions= restart/5000/restart/10000/restart/15000 | Out-Null
sc.exe failureflag "ProxyManagerAgent" 1 | Out-Null

echo "Starting service..."
Start-Service -Name "ProxyManagerAgent"

echo "Installation Complete!"
echo "The agent is now installed and configured to auto-start with Windows at boot (no login required)."
