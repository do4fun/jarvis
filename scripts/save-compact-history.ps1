# scripts/save-compact-history.ps1
# Sauvegarde le résumé d'auto/manual compact sur la branche orpheline "compact-history"
# via un git worktree dédié — aucun commit sur dev/main.

$ErrorActionPreference = 'SilentlyContinue'

$raw  = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json

# Le champ Claude Code s'appelle "compact_summary", pas "summary"
$rawSummary = if ($data.compact_summary) { $data.compact_summary }
              elseif ($data.summary)     { $data.summary }
              else                       { $raw }

# Extraire uniquement le contenu entre <summary>...</summary> (ignorer <analysis>)
if ($rawSummary -match '(?s)<summary>(.*)</summary>') {
    $body = $Matches[1].Trim()
} else {
    $body = $rawSummary.Trim()
}

$timestamp    = Get-Date -Format 'yyyy-MM-dd HH:mm'
$fileStamp    = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$root         = git rev-parse --show-toplevel
$branch       = git -C $root rev-parse --abbrev-ref HEAD
$worktreePath = "$root/.compact-worktree"
$histBranch   = "compact-history"

# En-tête markdown lisible
$header = @"
# Compact History — $timestamp

**Projet :** Jarvis
**Branche :** $branch
**Trigger :** $($data.trigger ?? 'auto')

---

"@

$content = $header + $body

# ── Créer la branche orpheline si elle n'existe pas ─────────────────────────
$branchExists = git -C $root branch --list $histBranch
if (-not $branchExists) {
    $emptyTree  = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    $commitHash = git -C $root commit-tree $emptyTree -m "init: compact-history [auto]"
    git -C $root branch $histBranch $commitHash
}

# ── Monter le worktree si absent ─────────────────────────────────────────────
if (-not (Test-Path $worktreePath)) {
    git -C $root worktree add $worktreePath $histBranch 2>&1 | Out-Null
}

# ── Écrire et committer le résumé ────────────────────────────────────────────
$file = "$worktreePath/$fileStamp.md"
Set-Content -Path $file -Value $content -Encoding utf8

git -C $worktreePath add "$fileStamp.md"
git -C $worktreePath commit -m "docs: compact $fileStamp [auto]"

# ── Pousser la branche orpheline (silencieux si remote absent) ───────────────
git -C $root push origin $histBranch 2>&1 | Out-Null
