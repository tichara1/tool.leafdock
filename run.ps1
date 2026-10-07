#requires -Version 5.1
<#
.SYNOPSIS
Build and start Leafdock locally using Docker Compose.
.DESCRIPTION
Safe to run repeatedly: preserves an existing .env and the data volume,
and reconciles the same Compose service instead of starting another instance.
Can be invoked from any working directory.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

function Invoke-Docker {
    param([string[]] $DockerArguments)

    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed (exit code $LASTEXITCODE)."
    }
}

try {
    if (-not (Get-Command docker -CommandType Application -ErrorAction SilentlyContinue)) {
        throw 'Docker is missing. Install Docker Desktop with Docker Compose and run this script again.'
    }

    Invoke-Docker -DockerArguments @('compose', 'version')
    Invoke-Docker -DockerArguments @('info', '--format', '{{.ServerVersion}}')

    $envFile = Join-Path $PSScriptRoot '.env'
    if (-not (Test-Path -LiteralPath $envFile)) {
        # Never overwrite credentials, even if another invocation creates the file.
        try {
            [System.IO.File]::Copy((Join-Path $PSScriptRoot '.env.example'), $envFile, $false)
            Write-Host 'Created .env from .env.example. Token settings are optional.'
        }
        catch {
            if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
                throw
            }
        }
    }

    $composeArguments = @(
        'compose',
        '--project-directory', $PSScriptRoot,
        '--file', (Join-Path $PSScriptRoot 'compose.yaml'),
        '--env-file', $envFile
    )

    Invoke-Docker -DockerArguments ($composeArguments + @(
        'up', '--detach', '--build', '--wait', '--wait-timeout', '120', 'leafdock'
    ))

    $address = Invoke-Docker -DockerArguments ($composeArguments + @('port', 'leafdock', '3000'))
    Write-Host "Leafdock is ready at http://$address"
}
catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    exit 1
}
