@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0KURULUM.ps1"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
    echo.
    echo Kurulum tamamlanamadi. Acik kalan hata mesajini ve KURULUM_LOG.txt dosyasini kontrol edin.
) else (
    echo.
    echo Kurulum islemi tamamlandi.
)
echo.
pause
endlocal & exit /b %INSTALL_EXIT%
