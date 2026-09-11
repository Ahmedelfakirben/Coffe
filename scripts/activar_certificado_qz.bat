@echo off
chcp 65001 >nul
:: Solicitar permisos de administrador si no los tiene
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador para actualizar QZ Tray...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo =====================================================
echo  Instalando certificado de HousePublique en QZ Tray
echo =====================================================
echo.

set "SOURCE_CERT=%~dp0hp_only.crt"
set "DEST_CERT=C:\Program Files\QZ Tray\override.crt"

if exist "%SOURCE_CERT%" (
    copy /Y "%SOURCE_CERT%" "%DEST_CERT%"
    echo [OK] Certificado copiado a: %DEST_CERT%
) else (
    echo [ERROR] No se encontro el archivo %SOURCE_CERT%
    pause
    exit /b
)

echo.
echo Reiniciando servicio de QZ Tray...
taskkill /F /IM qz-tray.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "C:\Program Files\QZ Tray\qz-tray.exe"

echo.
echo =====================================================
echo  ¡Listo! QZ Tray se ha reiniciado con el certificado.
echo =====================================================
timeout /t 3
