# Plan 001: Add a CI workflow that gates every PR on test/lint/build

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- .github/ Taskfile.yml web/package.json`
> If those changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

The repo has **no continuous-integration workflow**. `.github/workflows/`
contains only `release.yml` (tag-triggered binary builds). Nothing runs the Go
tests, Go lint, frontend tests, frontend lint, typecheck, or a build on pull
requests or pushes. Dependabot PRs (vite 7→8, eslint 9→10, etc.) auto-merge
with zero automated verification — commit `470b165` ("resolve npm dependency
conflict after dependabot merges") is direct evidence of breakage slipping in.
This is finding #1 because every other plan's done-criteria assume there is an
automated way to know a change is safe. CI is the verification baseline.

## Current state

- `.github/workflows/` — contains only `release.yml`. No `ci.yml`.
- `Taskfile.yml` defines the exact commands CI should run:
  - `task test` → `go test ./...` (Taskfile.yml:56-59)
  - `task lint` → `golangci-lint run` (Taskfile.yml:61-64)
  - `task build-web` → `cd web && npm run build` (deps on `deps-web` → `npm install`)
  - `task build` → `go build -ldflags ... -o vibediff .` (deps on `build-web`)
- Frontend scripts (`web/package.json:6-14`):
  - `npm run test` → `vitest run`
  - `npm run lint` → `eslint . --max-warnings 0`
  - `npm run build` → `tsc -b && vite build`
- Go version: `go 1.22` (go.mod:3). Node: README says 18+ (README.md:114);
  use Node 20 LTS in CI.
- `.golangci.yml` exists at repo root (golangci-lint config).
- Module path: `github.com/malvex/vibediff` (go.mod:1).
- **Default branch is `master`** (confirm with `git rev-parse --abbrev-ref HEAD`).

The build embeds web assets via `//go:embed all:web/dist` (main.go:34), so a Go
build REQUIRES `web/dist` to exist first. CI must build the web app before
`go build`/`go test` of the root package, OR the embed will fail. Note:
`go test ./...` compiles `main.go` too, so `web/dist` must exist before testing.
A `web/dist/.gitkeep` does NOT satisfy `all:web/dist` needing `index.html` for
the catch-all route at runtime, but for *compilation* an existing non-empty
`web/dist` dir is enough. Safest: run `task build-web` before any Go step.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Go test | `go test ./...` | exit 0 (currently "no test files", still exit 0) |
| Go lint | `golangci-lint run` | exit 0 |
| Web install | `cd web && npm ci` | exit 0 |
| Web build | `cd web && npm run build` | exit 0, creates `web/dist/` |
| Web test | `cd web && npm run test` | exit 0, tests pass |
| Web lint | `cd web && npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should create/modify):
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- `.github/workflows/release.yml` — release pipeline, unrelated.
- `Taskfile.yml`, `web/package.json` — do not change build commands here.
- Any source code — this plan adds CI only.

## Git workflow

- Branch: `advisor/001-ci-workflow`
- One commit; message style matches repo conventional commits (see
  `git log --oneline`: `build:`, `fix:`, `📦`). Use:
  `ci: add PR/push workflow running go + web test, lint, build`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the CI workflow

Create `.github/workflows/ci.yml` with two jobs (backend, frontend) that run on
push to `master` and on all pull requests. Use this exact content:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: web/dist

  backend:
    runs-on: ubuntu-latest
    needs: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true
      # Go build/test compiles main.go which //go:embed's web/dist.
      # Pull the built assets from the frontend job so embedding succeeds.
      - uses: actions/download-artifact@v4
        with:
          name: web-dist
          path: web/dist
      - run: go vet ./...
      - run: go test -race ./...
      - uses: golangci/golangci-lint-action@v6
        with:
          version: latest
```

**Verify**: `test -f .github/workflows/ci.yml && echo OK` → `OK`

### Step 2: Validate the YAML is well-formed

**Verify**: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"`
→ `valid`
(If `python3`/`yaml` unavailable, skip — the GitHub Actions runner will validate
on first push; do not treat absence of python as a failure.)

### Step 3: Locally reproduce what CI will do (sanity check)

Run the same commands CI runs, to confirm they pass at this commit:

```
cd web && npm ci && npm run lint && npm run test && npm run build && cd ..
go vet ./... && go test -race ./...
```

**Verify**: each command exits 0. `golangci-lint` may not be installed locally —
if `golangci-lint run` errors with "command not found", that is acceptable
(CI installs it); note it and continue. If any *other* command fails, that is a
pre-existing breakage — see STOP conditions.

## Test plan

This plan adds no application tests; it wires up the harness. Verification is
that the listed commands pass at the current commit (Step 3). The real proof is
the workflow running green on its first PR/push — note in the status row that
final confirmation requires a push (operator action).

## Done criteria

ALL must hold:

- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] Locally: `cd web && npm ci && npm run lint && npm run test && npm run build` exits 0
- [ ] Locally: `go vet ./...` exits 0 and `go test -race ./...` exits 0
- [ ] No files outside `.github/workflows/ci.yml` modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report (do not improvise) if:
- `npm run lint`, `npm run test`, `npm run build`, `go vet`, or `go test` fails
  at the current commit. That is a pre-existing breakage that must be reported
  and fixed before CI can be green — do NOT weaken the workflow (e.g. add
  `continue-on-error`) to make it pass.
- The default branch is not `master` (the `on.push.branches` value would be
  wrong) — report the actual branch name.
- `web/dist` embedding causes `go test ./...` to fail even after building the
  web app — report the exact error.

## Maintenance notes

- When adding the first Go tests (plan 003), they run automatically here — no CI
  change needed.
- When adding e2e tests (plan 004), add a third job (or extend) — that plan
  specifies its own CI wiring.
- Consider requiring this workflow as a branch-protection status check and
  gating dependabot auto-merge on it (operator/GitHub-settings task, not code).
- If build times grow, the Go and npm caches are already enabled; revisit
  artifact passing only if it becomes a bottleneck.
</content>
