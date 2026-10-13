# Resonance: first private-staging deploy to Railway (see DEPLOY_RAILWAY.md).
# WHERE TO RUN: PowerShell, any folder (the script moves into the project folder itself).
#   powershell -ExecutionPolicy Bypass -File D:\__BlueEmberWellness\05_Digital\Applications\Resonance\handoff\deploy-staging.ps1
# Safe to re-run: each step skips what is already done.
# Postgres has no public address, so database work runs inside Railway via `railway ssh`.
# Secrets are typed or generated here and never printed.

Set-Location 'D:\__BlueEmberWellness\05_Digital\Applications\Resonance'
function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED at: $what. Paste the output above to Claude." -ForegroundColor Red; exit 1 } }
function Plain($secure) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)) }

Step '0. Project link (this folder is already linked to Railway project Resonance)'
railway status | Select-Object -First 4; Check 'railway status'
Write-Host ("Deploying the code on branch: " + (git branch --show-current))

Step '1. resonance service'
railway variables --service resonance --json *> $null
if ($LASTEXITCODE -eq 0) { Write-Host 'Service already exists, skipping.' }
else { railway add --service resonance; Check 'add service' }

Step '2. Variables (non-secret)'
railway variables --service resonance --skip-deploys `
  --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' `
  --set 'REGISTRATION_OPEN=false' `
  --set 'REGISTRATION_ALLOWLIST=kantners@gmail.com' `
  --set 'HRV_LOG_SCALE=true' `
  --set 'OPENAI_VISION_MODEL=gpt-4o-mini' `
  --set 'ALLOW_DEMO_SEED=false' | Out-Null; Check 'set variables'

Step '3. Secrets (generated or typed; never shown)'
$names = (railway variables --service resonance --json | Out-String | ConvertFrom-Json).PSObject.Properties.Name
if ($names -contains 'SESSION_SECRET') { Write-Host 'SESSION_SECRET already set, keeping it.' }
else {
  $s = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  railway variables --service resonance --skip-deploys --set "SESSION_SECRET=$s" | Out-Null; Check 'set SESSION_SECRET'
  Remove-Variable s; Write-Host 'SESSION_SECRET set.'
}
if ($names -notcontains 'OPENAI_API_KEY') {
  $k = Plain (Read-Host 'OpenAI API key for screenshot import (press Enter to skip)' -AsSecureString)
  if ($k) { railway variables --service resonance --skip-deploys --set "OPENAI_API_KEY=$k" | Out-Null; Check 'set OPENAI_API_KEY' }
  Remove-Variable k
}

Step '4. Build and deploy (5-10 minutes; the build log streams below)'
railway up --service resonance --ci; Check 'railway up'

Step '5. Public HTTPS domain and health check'
railway domain --service resonance
$url = (Read-Host 'Paste the https://... address printed above').Trim().TrimEnd('/')
Write-Host 'Waiting for the health check (migrations run first)...'
$healthy = $false
for ($i = 0; $i -lt 30 -and -not $healthy; $i++) {
  try { $h = Invoke-RestMethod "$url/api/health" -TimeoutSec 10; if ($h.ok) { $healthy = $true; Write-Host "Healthy: rule version $($h.ruleVersion)" -ForegroundColor Green } }
  catch { Start-Sleep -Seconds 10 }
}
if (-not $healthy) { Write-Host 'Not healthy after 5 minutes. In this same folder run:  railway logs --service resonance   and paste it to Claude.' -ForegroundColor Red; exit 1 }

Step '6. What is in Postgres now (table names only, run inside Railway)'
railway ssh --service resonance -- node script/list-tables.mjs; Check 'list tables'
Write-Host 'Expected: the 16 Resonance tables plus drizzle.__drizzle_migrations. Anything else: tell Claude.'

Step '7. Demo data for the October 20 meeting (optional, runs inside Railway)'
Write-Host 'Seeds demo@resonance.local, dated so the Brief is current on Tue Oct 20. Every screen shows "Illustrative data".'
$seed = Read-Host 'Seed the demo account now? Y/N'
if ($seed -eq 'Y') {
  do {
    $dp = Plain (Read-Host 'Demo password: 12+ characters, letters and digits only' -AsSecureString)
  } until ($dp -match '^[A-Za-z0-9]{12,}$')
  railway ssh --service resonance -- env ALLOW_DEMO_SEED=true DEMO_DATE=2026-10-20 "DEMO_PASSWORD=$dp" npx tsx script/seed-demo.ts
  $seedExit = $LASTEXITCODE; Remove-Variable dp
  if ($seedExit -ne 0) { Write-Host 'Seed failed. Paste the output above to Claude.' -ForegroundColor Red; exit 1 }
}

Step 'Done'
Write-Host "Open $url and choose 'Create account' with kantners@gmail.com." -ForegroundColor Green
Write-Host 'Then tell Claude: "registered" plus the URL. Claude clears the allowlist and runs the security checks.'
