# scripts/save-compact-history.ps1
# Sauvegarde le résumé d'auto-compact dans docs/compact-history/ et le commet.

$ErrorActionPreference = 'SilentlyContinue'

$raw  = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json

$summary   = if ($data.summary) { $data.summary } else { $raw }
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$root      = git rev-parse --show-toplevel
$dir       = "$root/docs/compact-history"

New-Item -ItemType Directory -Force -Path $dir | Out-Null

$file = "$dir/$timestamp.md"
Set-Content -Path $file -Value $summary -Encoding utf8

git -C $root add $file
git -C $root commit -m "docs: compact history $timestamp [auto]"
