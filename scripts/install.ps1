# =============================================================================
# Jarvis — Script d'installation Windows
# =============================================================================
# Prérequis : Windows 10/11, PowerShell 5.1+, connexion internet
# Usage     : Clic-droit > "Exécuter avec PowerShell" OU
#             powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   JARVIS  —  Installation Windows          " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Helpers ───────────────────────────────────────────────────────────────────

function Test-Cmd($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Write-Step($msg) {
    Write-Host "`n>> $msg" -ForegroundColor Yellow
}

function Write-OK($msg) {
    Write-Host "   [OK] $msg" -ForegroundColor Green
}

function Write-Err($msg) {
    Write-Host "   [ERREUR] $msg" -ForegroundColor Red
}

function Refresh-Path {
    $env:Path = `
        [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
        [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ── 1. Node.js >= 18 ──────────────────────────────────────────────────────────

Write-Step "Vérification de Node.js (>= 18 requis)..."

if (Test-Cmd "node") {
    $nodeVer = node --version
    $nodeMajor = [int](($nodeVer -replace 'v','') -split '\.')[0]
    if ($nodeMajor -lt 18) {
        Write-Err "Node.js $nodeVer détecté — version >= 18 requise."
        Write-Host "   Mettez à jour via https://nodejs.org ou winget install OpenJS.NodeJS.LTS" -ForegroundColor Red
        exit 1
    }
    Write-OK "Node.js $nodeVer"
} else {
    Write-Host "   Node.js non trouvé. Tentative d'installation via winget..." -ForegroundColor Gray
    if (Test-Cmd "winget") {
        winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements -e
        Refresh-Path
        if (Test-Cmd "node") {
            Write-OK "Node.js $(node --version) installé"
        } else {
            Write-Err "Echec de l'installation. Installez manuellement : https://nodejs.org"
            exit 1
        }
    } else {
        Write-Err "winget introuvable. Installez Node.js LTS manuellement : https://nodejs.org"
        exit 1
    }
}

# ── 2. npm ────────────────────────────────────────────────────────────────────

Write-Step "Vérification de npm..."

if (Test-Cmd "npm") {
    Write-OK "npm $(npm --version)"
} else {
    Write-Err "npm introuvable (normalement inclus avec Node.js). Réinstallez Node.js."
    exit 1
}

# ── 3. Dépendances du projet ──────────────────────────────────────────────────

Write-Step "Installation des dépendances npm..."

# Remonter d'un niveau par rapport à /scripts
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

if (-not (Test-Path (Join-Path $projectRoot "package.json"))) {
    Write-Err "package.json introuvable dans $projectRoot"
    exit 1
}

Push-Location $projectRoot
try {
    npm install
    Write-OK "Dépendances installées"
} finally {
    Pop-Location
}

# ── 4. Fichier .env.local ─────────────────────────────────────────────────────

Write-Step "Configuration des variables d'environnement..."

$envExample = Join-Path $projectRoot ".env.local.example"
$envLocal   = Join-Path $projectRoot ".env.local"

if (-not (Test-Path $envLocal)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envLocal
        Write-Host "   .env.local créé depuis .env.local.example" -ForegroundColor Cyan
        Write-Host "   => Editez .env.local et renseignez vos clés API avant de démarrer" -ForegroundColor Yellow
    } else {
        Write-Host "   .env.local.example introuvable — créez .env.local manuellement" -ForegroundColor Yellow
    }
} else {
    Write-OK ".env.local déjà présent"
}

# ── 5. Extensions VS Code (optionnel) ────────────────────────────────────────

Write-Step "Extensions VS Code recommandées (optionnel)..."

if (Test-Cmd "code") {
    $extensions = @(
        "ms-vscode.vscode-typescript-next",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss"
    )
    foreach ($ext in $extensions) {
        code --install-extension $ext --force 2>$null
        Write-Host "   Installée : $ext" -ForegroundColor Gray
    }
    Write-OK "Extensions VS Code installées"
} else {
    Write-Host "   VS Code non trouvé dans le PATH — extensions ignorées" -ForegroundColor Gray
}

# ── Récapitulatif ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Installation terminée avec succès !      " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor White
Write-Host "  1. Editez  .env.local  avec vos cles API (Anthropic, ElevenLabs)" -ForegroundColor White
Write-Host "  2. Lancez  npm run dev" -ForegroundColor White
Write-Host "  3. Ouvrez  http://localhost:3000" -ForegroundColor White
Write-Host ""
