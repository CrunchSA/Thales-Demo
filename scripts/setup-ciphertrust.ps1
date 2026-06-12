<#
.SYNOPSIS
  Initializes CipherTrust policies and application registration for Thales Demo.

.DESCRIPTION
  This PowerShell script authenticates against the CipherTrust API, creates a
  protection policy, creates an access policy, and registers the application.

.PARAMETER EnvPath
  Path to the environment file containing CipherTrust configuration.
  Defaults to .env.local in the repository root.
#>

[CmdletBinding()]
param(
    [string]
    $EnvPath = ".env.local"
)

Set-StrictMode -Version Latest

# Script-scope variables for API request context
$script:BaseURL = ''
$script:Username = ''
$script:Password = ''
$script:Domain = ''
$script:Headers = @{}

function Load-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]
        $FilePath
    )

    if (-not (Test-Path $FilePath)) {
        throw "Environment file not found: $FilePath"
    }

    $env = @{}
    Get-Content -Path $FilePath | ForEach-Object {
        $line = $_.Trim()
        if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith('#')) {
            if ($line -match '^(.*?)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim().Trim('"')
                $env[$key] = $value
            }
        }
    }

    return $env
}

function Validate-Config {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]
        $Config
    )

    $required = @('CIPHERTRUST_URL', 'CIPHERTRUST_USERNAME', 'CIPHERTRUST_PASSWORD')
    $missing = $required | Where-Object { -not $Config.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($Config[$_]) }

    if ($missing.Count -gt 0) {
        throw "Missing required environment variables: $($missing -join ', ')"
    }

    if (-not $Config.ContainsKey('CIPHERTRUST_DOMAIN') -or [string]::IsNullOrWhiteSpace($Config['CIPHERTRUST_DOMAIN'])) {
        $Config['CIPHERTRUST_DOMAIN'] = 'default'
    }
}

function Get-ResponseBody {
    param(
        $Response
    )

    if ($null -eq $Response) {
        return $null
    }

    try {
        return $Response.Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Send-Request {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('GET', 'POST', 'PUT', 'DELETE')]
        [string]
        $Method,

        [Parameter(Mandatory = $true)]
        [string]
        $Path,

        [object]
        $Body
    )

    $uri = "$BaseURL$Path"
    $bodyJson = $null
    if ($Body) {
        $bodyJson = $Body | ConvertTo-Json -Depth 10
    }

    Write-Host "   $Method $uri"

    try {
        if ($bodyJson) {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $Headers -Body $bodyJson -ContentType 'application/json'
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $Headers
        }

        return [PSCustomObject]@{
            StatusCode = [int]$response.StatusCode
            Body = Get-ResponseBody -Response $response
            RawResponse = $response
        }
    } catch {
        $errorResponse = $_.Exception.Response
        if ($errorResponse -ne $null) {
            $responseStream = $errorResponse.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($responseStream)
            $content = $reader.ReadToEnd()
            $parsedBody = $null
            try {
                $parsedBody = $content | ConvertFrom-Json
            } catch {
                $parsedBody = $content
            }

            return [PSCustomObject]@{
                StatusCode = [int]$errorResponse.StatusCode
                Body = $parsedBody
                RawResponse = $content
            }
        }

        throw $_
    }
}

function Authenticate {
    Write-Host '🔐 Authenticating with CipherTrust...'

    $response = Send-Request -Method 'POST' -Path '/api/v1/auth/login' -Body @{ username = $Username; password = $Password }

    if ($response.StatusCode -ne 200) {
        throw "Authentication failed: $($response.StatusCode) $($response.Body?.message)"
    }

    if (-not $response.Body.token) {
        throw 'Authentication response did not include a token.'
    }

    return $response.Body.token
}

function Create-ProtectionPolicy {
    Write-Host "`n📋 Creating protection policy..."

    $policyData = @{ 
        name = 'app-protection-policy'
        description = 'Protection policy for Thales Demo application data'
        algorithm = 'AES'
        keySize = 256
        cipher = 'CBC'
        padding = 'PKCS5'
    }

    $response = Send-Request -Method 'POST' -Path '/api/v1/protection-policies' -Body $policyData

    if ($response.StatusCode -in 200, 201) {
        Write-Host '✅ Protection policy created successfully'
        Write-Host "   ID: $($response.Body.id)"
        return $response.Body
    }

    if ($response.StatusCode -eq 409) {
        Write-Host '⚠️  Protection policy already exists'
        return $response.Body
    }

    throw "Failed to create protection policy: $($response.StatusCode) $($response.Body?.message)"
}

function Create-AccessPolicy {
    Write-Host "`n📋 Creating access policy..."

    $policyData = @{ 
        name = 'app-access-policy'
        description = 'Access policy for Thales Demo application'
        rules = @(
            @{ resource = 'app-protection-policy'; action = 'read'; effect = 'allow' },
            @{ resource = 'keys'; action = 'use'; effect = 'allow' },
            @{ resource = 'keys'; action = 'create'; effect = 'allow' }
        )
    }

    $response = Send-Request -Method 'POST' -Path '/api/v1/access-policies' -Body $policyData

    if ($response.StatusCode -in 200, 201) {
        Write-Host '✅ Access policy created successfully'
        Write-Host "   ID: $($response.Body.id)"
        return $response.Body
    }

    if ($response.StatusCode -eq 409) {
        Write-Host '⚠️  Access policy already exists'
        return $response.Body
    }

    throw "Failed to create access policy: $($response.StatusCode) $($response.Body?.message)"
}

function Create-Application {
    param(
        [Parameter(Mandatory = $true)]
        $ProtectionPolicy,

        [Parameter(Mandatory = $true)]
        $AccessPolicy
    )

    Write-Host "`n📋 Creating application..."

    $appData = @{ 
        name = 'thales-demo-app'
        description = 'Thales Demo Application'
        type = 'service'
        protectionPolicy = $ProtectionPolicy.id
        accessPolicy = $AccessPolicy.id
    }

    $response = Send-Request -Method 'POST' -Path '/api/v1/applications' -Body $appData

    if ($response.StatusCode -in 200, 201) {
        Write-Host '✅ Application created successfully'
        Write-Host "   ID: $($response.Body.id)"
        Write-Host "   Name: $($response.Body.name)"
        return $response.Body
    }

    if ($response.StatusCode -eq 409) {
        Write-Host '⚠️  Application already exists'
        return $response.Body
    }

    throw "Failed to create application: $($response.StatusCode) $($response.Body?.message)"
}

function Main {
    try {
        Write-Host '🚀 Starting CipherTrust setup...`n'

        $config = Load-EnvFile -FilePath $EnvPath
        Validate-Config -Config $config

        $script:BaseURL = $config.CIPHERTRUST_URL.TrimEnd('/')
        $script:Username = $config.CIPHERTRUST_USERNAME
        $script:Password = $config.CIPHERTRUST_PASSWORD
        $script:Domain = $config.CIPHERTRUST_DOMAIN
        $script:Headers = @{ Authorization = "Bearer "; 'Content-Type' = 'application/json' }

        $token = Authenticate
        $Headers.Authorization = "Bearer $token"

        $protectionPolicy = Create-ProtectionPolicy
        $accessPolicy = Create-AccessPolicy
        $application = Create-Application -ProtectionPolicy $protectionPolicy -AccessPolicy $accessPolicy

        Write-Host "`n✨ Setup completed successfully!"
        Write-Host "`nConfiguration to use in your application:"
        Write-Host "  CIPHERTRUST_APP_ID=$($application.id)"
        Write-Host "  CIPHERTRUST_PROTECTION_POLICY=$($protectionPolicy.id)"
        Write-Host "  CIPHERTRUST_ACCESS_POLICY=$($accessPolicy.id)"
    } catch {
        Write-Error "`n❌ Setup failed: $($_.Exception.Message)"
        exit 1
    }
}

Main
