# RAG API - LLM Diagnostics & Troubleshooting Script
# Usage: .\diagnose-llm.ps1

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "🔧 RAG API - LLM Diagnostics Tool" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Settings
$ApiBaseUrl = "http://localhost:8085"
$ServerUrl = "http://localhost:8085"

function Test-HttpConnection {
    param(
        [string]$Url,
        [int]$Timeout = 5
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $Timeout -ErrorAction Stop
        return $response.StatusCode
    }
    catch {
        return $null
    }
}

function Test-PortOpen {
    param(
        [string]$Host,
        [int]$Port,
        [int]$Timeout = 5
    )

    try {
        $tcpConnection = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcpConnection.BeginConnect($Host, $Port, $null, $null)
        $waitHandle = $asyncResult.AsyncWaitHandle

        if ($waitHandle.WaitOne($Timeout * 1000, $false)) {
            if ($tcpConnection.Connected) {
                $tcpConnection.Close()
                return $true
            }
        }
        return $false
    }
    catch {
        return $false
    }
}

# ===== MAIN DIAGNOSTICS =====

Write-Host "1️⃣  Checking API Server..." -ForegroundColor Green
$serverStatus = Test-HttpConnection -Url "$ApiBaseUrl/health/llm-diagnostics"
if ($serverStatus) {
    Write-Host "   ✓ API Server is UP (HTTP $serverStatus)" -ForegroundColor Green
} else {
    Write-Host "   ✗ API Server is DOWN or not accessible" -ForegroundColor Red
    Write-Host "   Ensure server is running: java -jar target/RAG_API-1.0.0.jar" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "2️⃣  Running LLM Diagnostics..." -ForegroundColor Green

try {
    $diagnostics = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health/llm-diagnostics" -Method Get -ErrorAction Stop

    if ($diagnostics.diagnostics) {
        $result = $diagnostics.diagnostics

        Write-Host ""
        Write-Host "📋 Diagnostics Results:" -ForegroundColor Cyan
        Write-Host ""

        # API Key
        if ($result.apiKeyValid) {
            Write-Host "✅ API Key Valid" -ForegroundColor Green
        } else {
            Write-Host "❌ API Key INVALID" -ForegroundColor Red
            Write-Host "   → Check application.yml, section: openrouter.api-key" -ForegroundColor Yellow
        }

        # OpenRouter Connectivity
        if ($result.openRouterConnectivity) {
            Write-Host "✅ OpenRouter Connectivity" -ForegroundColor Green
        } else {
            Write-Host "❌ OpenRouter UNREACHABLE" -ForegroundColor Red
            Write-Host "   → Check firewall/network, try: Test-NetConnection -ComputerName openrouter.ai -Port 443" -ForegroundColor Yellow
        }

        # OpenRouter API Test
        Write-Host "ℹ️  OpenRouter API Test: $($result.openRouterApiTest)" -ForegroundColor Blue

        # Ollama Connectivity
        if ($result.ollamaConnectivity) {
            Write-Host "✅ Ollama Connectivity" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Ollama UNREACHABLE" -ForegroundColor Yellow
            Write-Host "   → Start Ollama: ollama serve" -ForegroundColor Yellow
            Write-Host "   → Or change base-url in application.yml if on different host" -ForegroundColor Yellow
        }

        Write-Host ""
        Write-Host "📌 Configuration:" -ForegroundColor Cyan
        foreach ($key in $result.configDetails.Keys) {
            Write-Host "   $key : $($result.configDetails[$key])" -ForegroundColor Gray
        }

        Write-Host ""
        Write-Host "🎯 Overall Status:" -ForegroundColor Cyan
        if ($result.overallStatus -match "✅") {
            Write-Host "   $($result.overallStatus)" -ForegroundColor Green
        } elseif ($result.overallStatus -match "⚠️") {
            Write-Host "   $($result.overallStatus)" -ForegroundColor Yellow
        } else {
            Write-Host "   $($result.overallStatus)" -ForegroundColor Red
        }

    } else {
        Write-Host "✗ Unexpected response format" -ForegroundColor Red
        Write-Host $diagnostics | ConvertTo-Json
    }
}
catch {
    Write-Host "✗ Failed to run diagnostics: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3️⃣  Testing Query (Optional)" -ForegroundColor Green
$testQuery = Read-Host "   Run test query? (Y/n)"

if ($testQuery -ne 'n' -and $testQuery -ne 'N') {
    Write-Host "   Sending test query..." -ForegroundColor Gray

    try {
        $body = @{
            question = "Nhà máy xử lý chất thải cần giấy phép gì?"
            detailLevel = "brief"
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$ApiBaseUrl/api/ai/query" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body `
            -TimeoutSec 30 `
            -ErrorAction Stop

        if ($response.answer) {
            Write-Host ""
            Write-Host "✅ Query Successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Response:" -ForegroundColor Cyan
            Write-Host $response.answer -ForegroundColor White
        } else {
            Write-Host "⚠️  No answer received" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "❌ Query Failed: $_" -ForegroundColor Red
        Write-Host "   Check server logs for error details" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "✅ Diagnostics Complete" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 For troubleshooting help, see:" -ForegroundColor Blue
Write-Host "   - TROUBLESHOOTING.md (comprehensive guide)"
Write-Host "   - DEPLOYMENT_GUIDE.md (setup instructions)"
Write-Host "   - Check server logs for detailed error messages"
Write-Host ""

# Offer interactive menu
Write-Host "What next?" -ForegroundColor Cyan
Write-Host "1 - View logs (REQUIRES server running with output redirected)"
Write-Host "2 - View troubleshooting guide"
Write-Host "3 - Exit"
$choice = Read-Host "Choose (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "📄 Server Logs:" -ForegroundColor Cyan
        Write-Host "(Make sure server is running with logs output. Try: java -jar target/RAG_API-1.0.0.jar | Tee logs.txt)" -ForegroundColor Yellow
    }
    "2" {
        if (Test-Path "TROUBLESHOOTING.md") {
            Get-Content TROUBLESHOOTING.md | Select-Object -First 100
            Write-Host "..."
            Write-Host "See TROUBLESHOOTING.md for full guide" -ForegroundColor Yellow
        } else {
            Write-Host "TROUBLESHOOTING.md not found" -ForegroundColor Yellow
        }
    }
    default {
        Write-Host "Goodbye!" -ForegroundColor Cyan
    }
}

