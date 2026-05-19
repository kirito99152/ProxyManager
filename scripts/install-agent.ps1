# ProxyManager Agent - Windows Install Script
# Usage: .\install-agent.ps1 -Server "proxy.ovncr.vn:50051"

param (
    [Parameter(Mandatory=$true)]
    [string]$Server
)

$Version = "0.68.0"
$InstallDir = "C:\ProxyManager"
$DashboardUrl = "https://proxy.ovncr.vn"
$FrpUrl = "https://github.com/fatedier/frp/releases/download/v$Version/frp_$(($Version))_windows_amd64.zip"

# 1. Create directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir
}

Set-Location $InstallDir

echo "Adding Windows Defender exclusion for $InstallDir..."
Add-MpPreference -ExclusionPath $InstallDir -ErrorAction SilentlyContinue

echo "Downloading Agent for Windows from ProxyManager Server..."
Invoke-WebRequest -Uri "$DashboardUrl/downloads/agent-windows-amd64.exe" -OutFile "$InstallDir\agent.exe"

echo "Downloading FRPC v$Version from official GitHub..."
$ZipFile = "$InstallDir\frp.zip"
Invoke-WebRequest -Uri $FrpUrl -OutFile $ZipFile

echo "Extracting FRPC..."
Expand-Archive -Path $ZipFile -DestinationPath "$InstallDir\temp" -Force
$ExtractedDir = Get-ChildItem -Path "$InstallDir\temp" -Directory | Select-Object -First 1
Move-Item -Path "$($ExtractedDir.FullName)\frpc.exe" -Destination "$InstallDir\frpc.exe" -Force
Remove-Item -Path "$InstallDir\temp" -Recurse -Force
Remove-Item -Path $ZipFile -Force

echo "Setting up Windows Service..."
# Remove old service if exists
$oldService = Get-Service -Name "ProxyManagerAgent" -ErrorAction SilentlyContinue
if ($oldService) {
    echo "Removing existing service..."
    Stop-Service -Name "ProxyManagerAgent" -Force -ErrorAction SilentlyContinue
    sc.exe delete "ProxyManagerAgent"
    Start-Sleep -s 2
}

# Create new service
New-Service -Name "ProxyManagerAgent" `
            -BinaryPathName "`"$InstallDir\agent.exe`" -server $Server" `
            -DisplayName "ProxyManager Client Agent" `
            -StartupType Automatic `
            -Description "Monitors host and manages FRP tunnels"

echo "Starting service..."
Start-Service -Name "ProxyManagerAgent"

echo "Installation Complete!"
echo "The agent is now running as a background service."
