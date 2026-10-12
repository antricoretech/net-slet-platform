param(
  [int]$Trials = 10,
  [string]$DatabaseUrl = $env:COLD_START_DATABASE_URL,
  [string]$RedisUrl = $env:REDIS_URL
)

$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { throw 'COLD_START_DATABASE_URL must target an isolated disposable database.' }
if (-not $RedisUrl) { throw 'REDIS_URL must target an isolated or explicitly verified Redis instance.' }
$database = [Uri]$DatabaseUrl
if ($database.Host -notin @('127.0.0.1', 'localhost') -or $database.Port -ne 55432 -or $database.AbsolutePath -ne '/stage_a_acceptance') {
  throw 'Refusing a non-isolated cold-start database URL.'
}
$env:DATABASE_URL = $DatabaseUrl
$env:REDIS_URL = $RedisUrl
$env:WEB_ORIGIN = 'http://localhost:3000'
$env:WEB_ORIGINS = 'http://localhost:3000'
$env:COLD_START_QA = '1'
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue

Write-Host 'Building the candidate once before production-like cold starts.'
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Candidate build failed; no cold-start trials were classified.' }

$results = @()
for ($trial = 1; $trial -le $Trials; $trial++) {
  $started = Get-Date
  Write-Host "=== independent cold-start trial $trial/$Trials ==="
  pnpm test:e2e tests/e2e/sprint2-acceptance.spec.ts --workers=1
  $exitCode = $LASTEXITCODE
  $results += [pscustomobject]@{ trial = $trial; exitCode = $exitCode; durationSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1) }
  if ($exitCode -ne 0) { $results | ConvertTo-Json | Set-Content 'test-results/cold-start-summary.json'; exit $exitCode }
}
$results | ConvertTo-Json | Set-Content 'test-results/cold-start-summary.json'
Write-Host "Cold-start QA passed: $Trials independent trials."
