# scripts/save-compact-history.ps1
# Sauvegarde le résumé d'auto/manual compact sur la branche orpheline "compact-history"
# via un git worktree dédié — aucun commit sur dev/main.

$ErrorActionPreference = 'SilentlyContinue'

$raw  = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json
$summary      = if ($data.summary) { $data.summary } else { $raw }
$timestamp    = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$root         = git rev-parse --show-toplevel
$worktreePath = "$root/.compact-worktree"
$branch       = "compact-history"

# ── Créer la branche orpheline si elle n'existe pas ─────────────────────────
# Utilise le SHA constant de l'arbre vide git (valide dans tout dépôt).
$branchExists = git -C $root branch --list $branch
if (-not $branchExists) {
    $emptyTree  = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    $commitHash = git -C $root commit-tree $emptyTree -m "init: compact-history [auto]"
    git -C $root branch $branch $commitHash
}

# ── Monter le worktree si absent ─────────────────────────────────────────────
if (-not (Test-Path $worktreePath)) {
    git -C $root worktree add $worktreePath $branch 2>&1 | Out-Null
}

# ── Écrire et committer le résumé ────────────────────────────────────────────
$file = "$worktreePath/$timestamp.md"
Set-Content -Path $file -Value $summary -Encoding utf8

git -C $worktreePath add "$timestamp.md"
git -C $worktreePath commit -m "docs: compact $timestamp [auto]"

# ── Pousser la branche orpheline (silencieux si remote absent) ───────────────
git -C $root push origin $branch 2>&1 | Out-Null
