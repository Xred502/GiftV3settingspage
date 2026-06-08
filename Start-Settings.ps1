# Starter för Microdeb GiftCard Inställningar
# Startar frontend + API och öppnar settings-sidan i webbläsaren

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Om kördes som .exe är scriptDir den katalogen med exe-filen
# men appen (node_modules, server/) finns i projektmappen
$projectDir = $scriptDir

# Leta upp node.exe
$nodePath = $null
$nodeCandidates = @(
    (Get-Command node -ErrorAction SilentlyContinue)?.Source,
    "C:\Program Files\nodejs\node.exe",
    "$env:APPDATA\nvm\current\node.exe",
    "$env:ProgramFiles\nodejs\node.exe"
)
foreach ($c in $nodeCandidates) {
    if ($c -and (Test-Path $c)) { $nodePath = $c; break }
}

if (-not $nodePath) {
    [System.Windows.Forms.MessageBox]::Show(
        "Node.js hittades inte. Installera Node.js från https://nodejs.org och försök igen.",
        "Fel - Microdeb Inställningar",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

$viteScript  = Join-Path $projectDir "node_modules\vite\bin\vite.js"
$serverScript = Join-Path $projectDir "server\index.js"

if (-not (Test-Path $viteScript)) {
    [System.Windows.Forms.MessageBox]::Show(
        "node_modules saknas. Öppna ett terminalfönster i projektmappen och kör:`nnpm install",
        "Fel - Microdeb Inställningar",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

Add-Type -AssemblyName System.Windows.Forms | Out-Null

# Kolla om tjänsterna redan körs
function Test-Url($url) {
    try {
        $req = [System.Net.WebRequest]::Create($url)
        $req.Timeout = 1500
        $resp = $req.GetResponse()
        $resp.Close()
        return $true
    } catch { return $false }
}

$settingsUrl = "http://localhost:8080/settings.html"
$viteUrl     = "http://localhost:8080"

if (Test-Url $viteUrl) {
    Start-Process $settingsUrl
    exit 0
}

# Starta API
$apiProc = Start-Process -FilePath $nodePath -ArgumentList @("`"$serverScript`"") `
    -WorkingDirectory $projectDir -WindowStyle Minimized -PassThru

# Starta Frontend (Vite)
$viteProc = Start-Process -FilePath $nodePath -ArgumentList @("`"$viteScript`"") `
    -WorkingDirectory $projectDir -WindowStyle Minimized -PassThru

# Vänta på att frontend startar (max 45 sekunder)
$deadline = (Get-Date).AddSeconds(45)
$ready = $false
while ((Get-Date) -lt $deadline) {
    if (Test-Url $viteUrl) { $ready = $true; break }
    Start-Sleep -Milliseconds 700
}

if ($ready) {
    Start-Process $settingsUrl
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Frontend startade inte inom 45 sekunder.`nKontrollera att port 8080 är ledig.",
        "Fel - Microdeb Inställningar",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
}
