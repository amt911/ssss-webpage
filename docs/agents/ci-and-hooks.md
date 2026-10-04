# CI & git hooks

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

## CI & git hooks

**Policy — the heavy gate runs locally on push; CI re-checks it on the PR and owns the release.**

- **Git hooks** (`.githooks/`) — install once per clone: `git config core.hooksPath .githooks`.
  - **pre-push** — `pnpm type-check`, `pnpm test:cov`, then **`pnpm test:mutation`** (slowest last;
    mutating over a red suite tells you nothing), all inside the memory cgroup. E2E stays out of the
    hook on purpose: it needs installed browsers, and CI runs it against the built artifact.
    Bypass: `git push --no-verify`, and then the breakage is yours.
- **Still run `pnpm test:all` by hand** before a release push — the hook covers everything except
  E2E. Wrap the heavy suites (coverage, mutation, Playwright) in the memory cgroup from the section
  above — always, no exceptions.
- **`.github/workflows/ci.yml`** (pushes to `main` + every PR) — blocking dependency audit,
  `type-check`, `test:cov`, Playwright E2E against the built artifact, and the check that the
  committed `dist/index.html` matches a fresh build. On **PRs only** it also runs
  **`pnpm test:mutation`**, `continue-on-error` for now, uploading `reports/mutation/` as an artifact
  (a bare percentage is not actionable; the survivor list is). Drop `continue-on-error` — and write
  the date here — once the score has cleared `thresholds.break` on two consecutive runs.
- **`.github/workflows/release.yml`**, triggered by a `v*` tag. It builds
  `dist/index.html` **from source** and attaches it plus `sha256sums.txt` to the GitHub Release, so a
  user can verify the artifact they download matches the tagged source. **The user creates and pushes
  the tag — the agent never pushes.**
- **If PR CI is ever added, keep it lean:** `pnpm type-check` only, plus a **blocking** dependency
  audit per the governance above (`pnpm install --frozen-lockfile` to prove the lockfile is honest,
  then `pnpm audit --prod --audit-level high`, no `continue-on-error`). Fix a failing audit by
  bumping — never by lowering `--audit-level`, and never by unpinning the crypto library.
