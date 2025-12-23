@echo off
echo ========================================
echo Running Migration 015
echo ========================================
echo.

set /p DB_PASSWORD="Enter PostgreSQL password: "

psql -U postgres -d security_management -f "database\migrations\015_create_personnel_records_and_equipment_checks.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Migration failed! Check errors above.
    echo ========================================
)

pause
