# Git branching — avoid unrelated histories

This repo once had **`main` and `newfeat` with no common Git ancestor** (two independent roots). GitHub then shows *“There isn’t anything to compare”* / *“entirely different commit histories”* and cannot open a normal PR diff.

## What we did (2026)

We merged `newfeat` into `main` with:

`git merge origin/newfeat --allow-unrelated-histories -X theirs`

(`-X theirs` kept **`newfeat`’s version** on conflicting paths while `main` was checked out.)

## What to do next time (team norms)

1. **Always branch from the canonical default branch** (`main`) after `git fetch origin && git checkout main && git pull`:
   - `git checkout -b feature/short-name`
   Do **not** start a long-lived line of work from an empty repo, a new `git init`, or a copy-paste folder without cloning `main` first.

2. **One remote, one truth** for this product: `origin/main`. Open PRs **from feature branches → `main`**, not from parallel “product” branches that never merged.

3. **Never `git push --force` to `main`** without team agreement and a backup ref.

4. **If you fork or scaffold elsewhere**, integrate by **cloning this repo** and cherry-picking or merging once — not by pushing a full unrelated tree as a new default branch.

5. **If GitHub still says unrelated histories**, fix once with an explicit merge (or rebase onto `main` only if you share a common ancestor). Prefer prevention: branch from `main`.

6. **Optional hygiene**: delete stale remote branches after merge so nobody bases work on dead tips.

---

Questions: ask before creating a second long-lived branch that could diverge from `main` without merges.
