# Plan 007: DX & docs polish — deps, README flags, CLAUDE.md, .env.example

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the result. Honor STOP conditions. Update the status row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- README.md web/package.json main.go`
> If changed, re-verify the flag list and audit output below; on mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent). 001 will verify the dep bump didn't break build.
- **Category**: dx / docs / deps
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

Small friction-reducers that round out production-readiness: a known-vulnerable
(dev-time) dependency, an undocumented CLI flag, and missing onboarding files for
humans and agents.

## Current state

- `npm audit` (run in `web/`) reports **1 high** (vite 8.0.0–8.0.15: launch-editor
  NTLMv2 disclosure + `server.fs.deny` bypass, both Windows/dev-server only) and
  **1 moderate** (js-yaml ≤4.1.1 quadratic DoS). Both fixable via `npm audit fix`.
  These are build/dev dependencies — they do NOT ship in the Go binary — so impact
  is limited to contributors, but the fix is trivial.
- `README.md:166-177` lists `-host`, `-port`, `-format`, `-debug`, `-version` but
  **omits `-no-open`** (defined main.go:65, disables browser auto-open; essential
  for headless/CI use) and the `VIBEDIFF_NO_OPEN` / `VIBEDIFF_DEBUG` env vars
  (main.go:86,164).
- No `CLAUDE.md`/`AGENTS.md` at repo root — agents (and new contributors) have no
  map of modules, commands, or conventions.
- No `.env.example` documenting the two env vars.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Audit | `cd web && npm audit` | after fix: "found 0 vulnerabilities" (or only unrelated) |
| Audit fix | `cd web && npm audit fix` | updates package-lock.json |
| Web build | `cd web && npm run build` | exit 0 |
| Web test | `cd web && npm run test` | all pass |
| Verify flags | `go run . -h` | help lists -no-open |

## Scope

**In scope**:
- `web/package.json`, `web/package-lock.json` (via `npm audit fix` only)
- `README.md` (document `-no-open` + env vars)
- `CLAUDE.md` (create)
- `.env.example` (create)

**Out of scope**:
- Source code changes. If `npm audit fix` wants `--force` (major/breaking bumps),
  do NOT apply it — see STOP conditions.

## Git workflow

- Branch: `advisor/007-dx-docs`
- Commit: `chore: fix npm audit, document -no-open, add CLAUDE.md and .env.example`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Fix the dependency vulnerabilities (non-breaking only)

```
cd web && npm audit fix
```
This should bump vite to a patched 8.x and js-yaml to ≥4.1.2 without breaking
changes. Then confirm nothing broke:
```
npm run lint && npm run test && npm run build
```
**Verify**: `cd web && npm audit` reports 0 (or only vulns with no non-breaking
fix); `npm run build` exits 0; `npm run test` passes.

### Step 2: Document `-no-open` and env vars in README

In `README.md` "Command Line Options" (lines 166-177), add:
```
  -no-open         Disable automatic browser opening (useful in CI/headless)
```
And add a short "Environment Variables" note: `VIBEDIFF_NO_OPEN` (any non-empty
value disables browser opening) and `VIBEDIFF_DEBUG` (`true` enables debug logging).

**Verify**: `grep -n "no-open" README.md` matches; `go run . -h` output matches
the documented flags (run with `-no-open` so it doesn't open a browser, or just
read the help and Ctrl-C).

### Step 3: Create CLAUDE.md

Create `CLAUDE.md` at repo root with: project one-liner; the **exact** build/
test/lint commands (`task build`, `task test` / `go test ./...`, `task lint`,
`cd web && npm run test|lint|build`); a module map (`main.go`, `internal/git`,
`internal/handlers`, `internal/review`, `internal/watcher`, `web/src`); test
conventions (Go: `testing` + `httptest`, temp git repos via `t.TempDir()`;
frontend: Vitest + Testing Library; e2e: Playwright in `web/e2e`); and the
"build web before any Go build/test because main.go embeds web/dist" gotcha.
Keep it tight (under ~60 lines) and accurate — verify each command exists in
`Taskfile.yml`/`web/package.json` before listing it.

**Verify**: `test -f CLAUDE.md && echo OK` → OK. Every command in it actually
runs (spot-check `task test` and `cd web && npm run test`).

### Step 4: Create .env.example

Create `.env.example`:
```
# Enable verbose debug logging
VIBEDIFF_DEBUG=false
# Set to any non-empty value to disable automatic browser opening
VIBEDIFF_NO_OPEN=
```
**Verify**: `test -f .env.example && echo OK` → OK.

## Test plan

No application tests. Verification = audit clean, build/test pass after the dep
bump, files exist, documented commands actually run.

## Done criteria

ALL must hold:

- [ ] `cd web && npm audit` shows the high/moderate resolved (or documents why a
      remaining one needs a breaking change — left for a follow-up)
- [ ] `cd web && npm run build && npm run test && npm run lint` all exit 0
- [ ] `grep -n "no-open" README.md` matches
- [ ] `CLAUDE.md` and `.env.example` exist
- [ ] No source files modified (`git status` shows only docs + web/package*.json + plans/README.md)
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report if:
- `npm audit fix` reports the only remaining fix requires `npm audit fix --force`
  (a breaking major bump). Do NOT force it — report which package/version and let
  the maintainer decide (CI from plan 001 will catch regressions on a deliberate bump).
- The dep bump breaks `npm run build` or `npm run test`. Report the failure;
  revert `package.json`/`package-lock.json` (`git checkout -- web/package.json web/package-lock.json`).

## Maintenance notes

- Reviewer: verify CLAUDE.md commands match Taskfile/package.json exactly (stale
  docs are worse than none).
- Once CI (plan 001) gates dependabot, these audit bumps get verified
  automatically — consider enabling auto-merge only after CI passes.
</content>
