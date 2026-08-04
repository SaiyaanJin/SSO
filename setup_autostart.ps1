#Requires -RunAsAdministrator

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BEBat = "e:\Applications\SSO\sso_be\sso_be_start.bat"
$FEBat = "e:\Applications\SSO\sso_fe\sso_fe_start.bat"

function Register-SSOTask {
    param(
        [string]$TaskName,
        [string]$BatPath,
        [int]$DelaySeconds,
        [string]$TaskDescription
    )

    Write-Host "  Registering task: $TaskName ..." -ForegroundColor Cyan

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false | Out-Null
        Write-Host "    (removed existing task)" -ForegroundColor DarkGray
    }

    $Action = New-ScheduledTaskAction `
        -Execute "cmd.exe" `
        -Argument "/c `"$BatPath`"" `
        -WorkingDirectory (Split-Path $BatPath -Parent)

    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Trigger.Delay = "PT${DelaySeconds}S"

    $Principal = New-ScheduledTaskPrincipal `
        -UserId "NT AUTHORITY\SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest

    $Settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew

    $Task = New-ScheduledTask `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description $TaskDescription

    Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force | Out-Null
    Write-Host "    OK - task registered." -ForegroundColor Green
}

function Register-NginxTask {
    param(
        [string]$TaskName,
        [string]$NginxExe,
        [int]$DelaySeconds,
        [string]$TaskDescription
    )

    Write-Host "  Registering task: $TaskName ..." -ForegroundColor Cyan

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false | Out-Null
        Write-Host "    (removed existing task)" -ForegroundColor DarkGray
    }

    $NginxDir = Split-Path $NginxExe -Parent

    $Action = New-ScheduledTaskAction `
        -Execute $NginxExe `
        -WorkingDirectory $NginxDir

    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Trigger.Delay = "PT${DelaySeconds}S"

    $Principal = New-ScheduledTaskPrincipal `
        -UserId "NT AUTHORITY\SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest

    $Settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew

    $Task = New-ScheduledTask `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description $TaskDescription

    Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force | Out-Null
    Write-Host "    OK - task registered." -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  SSO Auto-Start Task Scheduler Setup" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

$NginxExe = "E:\Applications\nginx-1.27.4\nginx-1.27.4\nginx.exe"

foreach ($f in @($BEBat, $FEBat, $NginxExe)) {
    if (-not (Test-Path $f)) {
        Write-Error "Required file not found: $f"
        exit 1
    }
}

Register-NginxTask `
    -TaskName "SSO_Nginx" `
    -NginxExe $NginxExe `
    -DelaySeconds 10 `
    -TaskDescription "Nginx reverse proxy - starts 10s after system boot"

Register-SSOTask `
    -TaskName "SSO_Backend" `
    -BatPath $BEBat `
    -DelaySeconds 30 `
    -TaskDescription "SSO Backend (ldapcode.py) - starts 30s after system boot"

Register-SSOTask `
    -TaskName "SSO_Frontend" `
    -BatPath $FEBat `
    -DelaySeconds 60 `
    -TaskDescription "SSO Frontend (npm start port 8080) - starts 60s after system boot"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "All 3 tasks will start automatically on next reboot:" -ForegroundColor White
Write-Host "  SSO_Nginx     -> starts at boot + 10s" -ForegroundColor DarkGray
Write-Host "  SSO_Backend   -> starts at boot + 30s" -ForegroundColor DarkGray
Write-Host "  SSO_Frontend  -> starts at boot + 60s" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To verify task status:" -ForegroundColor Cyan
Write-Host "  Get-ScheduledTask -TaskName SSO_Nginx    | Select-Object TaskName, State" -ForegroundColor DarkGray
Write-Host "  Get-ScheduledTask -TaskName SSO_Backend  | Select-Object TaskName, State" -ForegroundColor DarkGray
Write-Host "  Get-ScheduledTask -TaskName SSO_Frontend | Select-Object TaskName, State" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To run NOW without rebooting:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName SSO_Nginx" -ForegroundColor DarkGray
Write-Host "  Start-ScheduledTask -TaskName SSO_Backend" -ForegroundColor DarkGray
Write-Host "  Start-ScheduledTask -TaskName SSO_Frontend" -ForegroundColor DarkGray
Write-Host ""
