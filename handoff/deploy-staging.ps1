# Resonance: first private-staging deploy to Railway (see DEPLOY_RAILWAY.md).
# Run in PowerShell (the Bypass applies to this one run only):
#   powershell -ExecutionPolicy Bypass -File D:\__BlueEmberWellness\05_Digital\Applications\Resonance\handoff\deploy-staging.ps1
# Secrets are typed or generated here and never printed.

Set-Location 'D:\__BlueEmberWellness\05_Digital\Applications\Resonance'
function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED at: $what. Paste the output above to Claude." -ForegroundColor Red; exit 1 } }
function Plain($secure) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)) }

Step '0. Railway CLI up to date, project linked'
railway upgrade --yes
railway link --project Resonance --environment production; Check 'link'
Write-Host ("Deploying the code on branch: " + (git branch --show-current))

Step '1. What is already in Postgres? (table names only, no data)'
$pgVars = railway variables --service Postgres --json | ConvertFrom-Json; Check 'read Postgres URL'
$env:PGURL = $pgVars.DATABASE_PUBLIC_URL
node script\list-tables.mjs; Check 'list tables'
Remove-Item Env:PGURL
$ok = Read-Host "Continue only if that says '(no tables)' or shows only Resonance tables (users, sleep_logs, study_..., session, drizzle...). Type Y to continue"
if ($ok -ne 'Y') { Write-Host 'Stopped. Paste the table list to Claude.'; exit 0 }

Step '2. Create the resonance service'
railway add --service resonance; Check 'add service'

Step '3. Variables (non-secret)'
railway variables --service resonance --skip-deploys `
  --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' `
  --set 'REGISTRATION_OPEN=false' `
  --set 'REGISTRATION_ALLOWLIST=kantners@gmail.com' `
  --set 'HRV_LOG_SCALE=true' `
  --set 'OPENAI_VISION_MODEL=gpt-4o-mini' `
  --set 'ALLOW_DEMO_SEED=false' | Out-Null; Check 'set variables'

Step '4. Secrets (generated or typed; never shown)'
$s = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
railway variables --service resonance --skip-deploys --set "SESSION_SECRET=$s" | Out-Null; Check 'set SESSION_SECRET'
Remove-Variable s
$k = Plain (Read-Host 'OpenAI API key for screenshot import (press Enter to skip)' -AsSecureString)
if ($k) { railway variables --service resonance --skip-deploys --set "OPENAI_API_KEY=$k" | Out-Null; Check 'set OPENAI_API_KEY' }
Remove-Variable k
Write-Host 'Variables set.'

Step '5. Build and deploy (5-10 minutes; build log streams below)'
railway up --service resonance --ci; Check 'railway up'

Step '6. Public HTTPS domain'
railway domain --service resonance
$url = (Read-Host 'Paste the https://... address printed above').Trim().TrimEnd('/')
Write-Host 'Waiting for the health check (migrations run first)...'
$healthy = $false
for ($i = 0; $i -lt 30 -and -not $healthy; $i++) {
  try { $h = Invoke-RestMethod "$url/api/health" -TimeoutSec 10; if ($h.ok) { $healthy = $true; Write-Host "Healthy: rule version $($h.ruleVersion)" -ForegroundColor Green } }
  catch { Start-Sleep -Seconds 10 }
}
if (-not $healthy) { Write-Host 'Not healthy after 5 minutes. Run: railway logs --service resonance   and paste it to Claude.' -ForegroundColor Red; exit 1 }

Step '7. Demo data for the October 20 meeting (optional)'
Write-Host 'Seeds demo@resonance.local, dated so the Brief is current on Tue Oct 20. Every screen shows "Illustrative data".'
$seed = Read-Host 'Seed the demo account now? Y/N'
if ($seed -eq 'Y') {
  $dp = Plain (Read-Host 'Choose the demo password (8+ characters; you will log in with it)' -AsSecureString)
  $env:DATABASE_URL = $pgVars.DATABASE_PUBLIC_URL
  $env:ALLOW_DEMO_SEED = 'true'; $env:DEMO_DATE = '2026-10-20'; $env:DEMO_PASSWORD = $dp
  npm.cmd run seed:demo; $seedExit = $LASTEXITCODE
  Remove-Item Env:DATABASE_URL, Env:ALLOW_DEMO_SEED, Env:DEMO_DATE, Env:DEMO_PASSWORD
  Remove-Variable dp
  if ($seedExit -ne 0) { Write-Host 'Seed failed. Paste the output above to Claude.' -ForegroundColor Red; exit 1 }
}

Step 'Done'
Write-Host "Open $url and choose 'Create account' with kantners@gmail.com." -ForegroundColor Green
Write-Host 'Then tell Claude: "registered" plus the URL. Claude clears the allowlist and runs the security checks.'
