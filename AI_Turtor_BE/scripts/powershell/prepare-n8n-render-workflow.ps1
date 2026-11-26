param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$BackendBaseUrl
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& (Join-Path $PSScriptRoot 'fix-n8n-respond-nodes.ps1')
& (Join-Path $PSScriptRoot 'remove-bom.ps1')

$source = Join-Path $root 'n8n-import\AI-tutor-workflow-runtime-fixed.json'
$target = Join-Path $root 'n8n-import\AI-tutor-workflow-render-ready.json'
$base = $BackendBaseUrl.TrimEnd('/')
$json = Get-Content -Raw -Encoding UTF8 $source
$json = $json.Replace('http://host.docker.internal:8085', $base)
[System.IO.File]::WriteAllText($target, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "Render-ready n8n workflow: $target"
Write-Host "Backend base URL: $base"
