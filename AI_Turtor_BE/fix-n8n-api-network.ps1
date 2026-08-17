param(
    [string]$ApiNetwork = 'ai_turtor_be_ai-tutor-net',
    [string]$N8nContainer = 'ai-tutor-n8n',
    [string]$ApiContainer = 'ai-tutor-api'
)

$ErrorActionPreference = 'Stop'

function Test-ApiFromN8n {
    docker exec $N8nContainer wget -qO- --timeout=5 "http://ai-tutor-api:8085/actuator/health" 2>$null
}

Write-Host "Ensuring n8n can resolve ai-tutor-api on Docker network '$ApiNetwork'..."

$networkExists = docker network ls --format '{{.Name}}' | Select-String -SimpleMatch $ApiNetwork
if (-not $networkExists) {
    throw "Docker network '$ApiNetwork' was not found. Start the stack with docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d"
}

$connected = docker inspect $N8nContainer --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>$null
if ($connected -notmatch [regex]::Escape($ApiNetwork)) {
    Write-Host "Connecting $N8nContainer -> $ApiNetwork"
    docker network connect $ApiNetwork $N8nContainer | Out-Null
}

try {
    $health = Test-ApiFromN8n
    Write-Host "OK: n8n reached ai-tutor-api -> $health"
} catch {
    throw "n8n still cannot reach ai-tutor-api. Check that '$ApiContainer' is running on '$ApiNetwork'."
}

Write-Host 'Network fix complete. Re-run the n8n workflow or refresh the failed execution.'
