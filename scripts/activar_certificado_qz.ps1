# Script de PowerShell para instalar el certificado de HousePublique en QZ Tray
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " Instalando certificado de HousePublique en QZ Tray" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$sourceCert = "c:\Users\elfakir\Desktop\Coffe\Coffe\scripts\override_combined.crt"
$destCert = "C:\Program Files\QZ Tray\override.crt"

if (Test-Path $sourceCert) {
    Copy-Item -Path $sourceCert -Destination $destCert -Force
    Write-Host "[OK] Certificado copiado a: $destCert" -ForegroundColor Green
} else {
    Write-Host "[ERROR] No se encontro $sourceCert" -ForegroundColor Red
    exit 1
}

Write-Host "Reiniciando servicio de QZ Tray..." -ForegroundColor Yellow
Stop-Process -Name "qz-tray" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process "C:\Program Files\QZ Tray\qz-tray.exe"

Write-Host "=====================================================" -ForegroundColor Green
Write-Host " ¡Listo! QZ Tray se ha reiniciado con el certificado." -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
