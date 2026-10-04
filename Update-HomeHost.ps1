$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot

try {
    $dirty = git status --porcelain
    if ($dirty) {
        Write-Host "Local tracked changes detected. Update stopped so nothing is overwritten." -ForegroundColor Yellow
        git status --short
        exit 1
    }

    Write-Host "Pulling latest Docs code..." -ForegroundColor Cyan
    git pull --ff-only

    Write-Host "Building and restarting Docker services..." -ForegroundColor Cyan
    docker compose up -d --build

    Write-Host "Waiting for local health check..." -ForegroundColor Cyan
    $healthy = $false

    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:3002/api/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                Write-Host $response.Content -ForegroundColor Green
                break
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    docker compose ps

    if (-not $healthy) {
        Write-Host "The containers started, but the app health check did not become ready." -ForegroundColor Red
        Write-Host "Run: docker compose logs app --tail 100" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "Docs update complete." -ForegroundColor Green
}
finally {
    Pop-Location
}
