# Run or build the mobile app against an AI Tutor stack reached through the router (LAN).
#
# Offline stack (default) - the Mac on the TP-Link router, reserved IP 192.168.0.100.
#   docker-compose.offline.yml serves Caddy on port 80, which proxies /api, /ws and
#   /webhook to the backend and n8n, so the app only needs http://<ip> without ports.
#     .\scripts\run-lan.ps1                    # flutter run on the connected phone
#     .\scripts\run-lan.ps1 -Build             # release APK to install on phones
#     .\scripts\run-lan.ps1 -HostIp 192.168.0.120   # Mac got another IP
#
# Deploy stack on this PC (docker-compose.deploy.yml): backend :8085, n8n :5678.
#     .\scripts\run-lan.ps1 -Deploy [-Build]   # IP auto-detected from this PC
#
# The phone must be on the same Wi-Fi/router as the server.
param(
    [string]$HostIp,
    [switch]$Deploy,
    [switch]$Build,
    [string]$Device
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($Deploy) {
    if (-not $HostIp) {
        # Interface that owns the default route = the adapter connected to the router.
        $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' |
            Sort-Object -Property { $_.RouteMetric + $_.InterfaceMetric } |
            Select-Object -First 1
        $HostIp = (Get-NetIPAddress -InterfaceIndex $route.ifIndex -AddressFamily IPv4 |
            Select-Object -First 1).IPAddress
    }
    if (-not $HostIp) { throw 'Could not detect the LAN IP. Pass -HostIp <ip>.' }
    $config = [ordered]@{
        API_BASE_URL = "http://${HostIp}:8085"
        N8N_WEBHOOK  = "http://${HostIp}:5678/webhook"
    }
    $configFile = 'config/lan.json'
    $checks = @("$($config.API_BASE_URL)/actuator/health", "http://${HostIp}:5678/healthz")
} else {
    if (-not $HostIp) { $HostIp = '192.168.0.100' }   # reserved IP of the Mac on the TP-Link router
    $config = [ordered]@{
        API_BASE_URL = "http://${HostIp}"
        N8N_WEBHOOK  = "http://${HostIp}/webhook"
    }
    $configFile = 'config/offline-lan.json'
    # /health = Caddy; /api/users/me answers 401 without a token, proving the backend proxy works.
    $checks = @("http://${HostIp}/health", "http://${HostIp}/api/users/me")
}

$config | ConvertTo-Json | Out-File -FilePath (Join-Path $root $configFile) -Encoding ascii
Write-Host "$configFile -> $($config.API_BASE_URL) | $($config.N8N_WEBHOOK)"

foreach ($url in $checks) {
    try {
        $code = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5).StatusCode
        Write-Host "  OK  $url ($code)"
    } catch {
        $response = $_.Exception.Response
        if ($response) {
            Write-Host "  OK  $url ($([int]$response.StatusCode), server answered)"
            continue
        }
        Write-Warning "  Cannot reach $url - same router? stack running?"
    }
}

if ($Build) {
    flutter build apk --release "--dart-define-from-file=$configFile"
    Write-Host 'APK: build/app/outputs/flutter-apk/app-release.apk'
} else {
    $runArgs = @('run', "--dart-define-from-file=$configFile")
    if ($Device) { $runArgs += @('-d', $Device) }
    flutter @runArgs
}
