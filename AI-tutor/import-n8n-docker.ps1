param(
    [string]$BackendBaseUrl = 'http://ai-tutor-api:8085',
    [string]$ComposeFile = 'docker-compose.deploy.yml',
    [string]$EnvFile = '.env.deploy',
    [int]$MaxWaitSeconds = 180
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$importDir = Join-Path $root 'n8n-import'
$readyDir = Join-Path $importDir 'docker-ready'
$files = @(
    'AI-tutor-workflow-runtime-fixed.json',
    'AI-tutor-v2-proactive-workflows.json',
    'AI-tutor-teacher-ai-grading.json'
)

function Wait-HttpOk {
    param([string]$Url, [int]$TimeoutSec)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
            return $true
        } catch {
            Start-Sleep -Seconds 3
        }
    }
    return $false
}

Write-Host 'Preparing docker-ready n8n workflow files...'
New-Item -ItemType Directory -Force -Path $readyDir | Out-Null
$base = $BackendBaseUrl.TrimEnd('/')
foreach ($file in $files) {
    $source = Join-Path $importDir $file
    if (-not (Test-Path $source)) {
        throw "Missing workflow file: $source"
    }
    $target = Join-Path $readyDir $file
    $json = Get-Content -Raw -Encoding UTF8 $source
    $json = $json.Replace('http://host.docker.internal:8085', $base)
    [System.IO.File]::WriteAllText($target, $json, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  -> $target"
}

Write-Host 'Waiting for n8n health...'
if (-not (Wait-HttpOk -Url 'http://localhost:5678/healthz' -TimeoutSec $MaxWaitSeconds)) {
    throw 'n8n did not become healthy in time.'
}

Write-Host 'Importing workflows into n8n container...'
foreach ($file in $files) {
    $containerPath = "/import/docker-ready/$file"
    Write-Host "Importing $file ..."
    docker exec ai-tutor-n8n n8n import:workflow --input=$containerPath | Write-Host
}

Write-Host 'Publishing imported workflows...'
$workflowList = docker exec ai-tutor-n8n n8n list:workflow 2>&1
$workflowList | ForEach-Object {
    if ($_ -match '^([^|]+)\|') {
        $id = $Matches[1]
        Write-Host "Publishing $id ..."
        docker exec ai-tutor-n8n n8n publish:workflow --id=$id | Write-Host
    }
}

Write-Host 'Restarting n8n to apply published workflows...'
docker restart ai-tutor-n8n | Out-Null
if (-not (Wait-HttpOk -Url 'http://localhost:5678/healthz' -TimeoutSec $MaxWaitSeconds)) {
    throw 'n8n did not become healthy after restart.'
}

Write-Host 'Done. Imported workflows:'
docker exec ai-tutor-n8n n8n list:workflow 2>&1 | Write-Host
