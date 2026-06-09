# Build the static (export) demo site and deploy it to Firebase Hosting.
#
# Prereqs (one-time):
#   1) npm i -g firebase-tools
#   2) firebase login          (interactive; opens a browser)
#   3) Create a Firebase project at https://console.firebase.google.com
#      then put its project id into .firebaserc ("default": "<project-id>")
#
# The demo build points the API at a non-resolving host so every request
# fails fast and the app serves the frozen real-data snapshot
# (public/snapshot/data.json). No live backend / VPN needed by visitors.
#
# Run from the repo root:  ./scripts/deploy-demo.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Push-Location (Join-Path $root "app/frontend")
try {
    $env:NEXT_EXPORT = "1"
    $env:NEXT_PUBLIC_API_BASE_URL = "https://offline.invalid"
    Write-Host "Building static export (demo)..." -ForegroundColor Cyan
    npm run build
}
finally {
    Remove-Item Env:NEXT_EXPORT -ErrorAction SilentlyContinue
    Remove-Item Env:NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting

Write-Host "Done. Your team URL is shown above (https://<project-id>.web.app)." -ForegroundColor Green
