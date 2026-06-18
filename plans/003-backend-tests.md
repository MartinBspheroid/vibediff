# Plan 003: Establish backend Go test coverage (parser, service, store, handlers)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- internal/`
> If those changed, compare the "Current state" excerpts against live code; on a
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 001 (CI runs these). Coordinate file overlap with 002.
- **Category**: tests
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

The Go backend — diff parsing, git command orchestration, the review store, the
file watcher — has **zero tests** (no `*_test.go` anywhere). The diff parser
(`internal/git/parser.go`, regex-driven hunk parsing) is the most fragile piece:
a single off-by-one or regex miss silently corrupts every diff the product
renders. These are characterization tests: capture current correct behavior so
later refactors (and dependabot bumps) can't regress it.

## Current state

- `internal/git/parser.go` — `newDiffParser(diff string)`, `parse() ([]FileDiff, error)`.
  Parses `diff --git` blocks, `@@` hunk headers (regex parser.go:94), and `+`/`-`/` `
  line prefixes into `Line` structs with old/new line numbers.
- `internal/git/types.go` — defines `DiffType` (`all`/`staged`/`unstaged`),
  `FileDiff`, `Hunk`, `Line`, `LineType*`, `FileStatus*` constants. **Read this
  file first** to get exact field/constant names before writing assertions.
- `internal/git/service.go` — `Service` shells out to `git`. `GetDiff`,
  `GetFileDiff`, `getUntrackedFiles`, etc. Integration-testable by creating a
  temp git repo.
- `internal/review/store.go` — `Store` with `sync.RWMutex`; `AddComment`,
  `GetComments(file)`, `GetAllComments`, `DeleteComment(id)`. `AddComment`
  assigns a random ID and `CreatedAt`.
- `internal/handlers/handlers.go` — HTTP handlers; `NewHandler(gitService, reviewStore)`.
  Testable with `httptest`.
- No existing Go test to model after. Use standard `testing` + `net/http/httptest`.
  **No new test deps** — table-driven tests, standard library only (matches a
  minimal-deps repo: go.mod has only gorilla/mux + websocket).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build web (embed) | `cd web && npm run build && cd ..` | web/dist exists |
| Test a package | `go test ./internal/git/...` | all pass |
| Test all + race | `go test -race ./...` | all pass |
| Coverage | `go test -cover ./internal/...` | prints % per package |
| Vet | `go vet ./...` | exit 0 |

> `go test ./...` compiles `main.go` (which `//go:embed`s `web/dist`). If
> `web/dist` is absent, build the web app first (or test only `./internal/...`
> which does not import the embed). Prefer `go test ./internal/...` while
> iterating, then `go test -race ./...` once at the end.

## Scope

**In scope** (create these):
- `internal/git/parser_test.go`
- `internal/git/service_test.go`
- `internal/review/store_test.go`
- `internal/handlers/handlers_test.go`

**Out of scope**:
- Any non-test source file. This plan is tests-only. If a test reveals a bug, do
  NOT fix it here — record it in the status row / report and let the relevant
  plan (002, 005, 006) own the fix. Exception: if `internal/git/service_test.go`
  was already created by plan 002, EXTEND it, don't overwrite.
- `internal/watcher/` — polling watcher is timing-dependent; deferred (note it).

## Git workflow

- Branch: `advisor/003-backend-tests`
- Commit message: `test: add backend unit and integration tests for git, review, handlers`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read `internal/git/types.go` and write parser tests

Read `internal/git/types.go` for exact struct/field/constant names. Then create
`internal/git/parser_test.go` with table-driven tests feeding raw `git diff`
output to `newDiffParser(input).parse()` and asserting the parsed structure.

Cover at minimum:
- A simple single-file modification with one hunk (assert `Path`, `Status ==
  FileStatusModified`, hunk `OldStart`/`NewStart`/`OldLines`/`NewLines`, and that
  `+`/`-`/context lines get the right `LineType` and line numbers).
- A new file (`new file mode ...` → `FileStatusAdded`).
- A deleted file (`deleted file mode ...` → `FileStatusDeleted`).
- A binary file (`Binary files ... differ` → `IsBinary == true`).
- A hunk header without explicit counts (`@@ -1 +1 @@`) → `OldLines`/`NewLines`
  default to 1 (parser.go:107-116).
- Additions/Deletions counts computed correctly (parser.go:78-87).
- Empty diff input → empty slice, no error.

Use real `git diff` text as the literal input (generate samples by running
`git diff` on a scratch change if helpful, but paste static strings into the
test so it has no runtime git dependency).

**Verify**: `go test ./internal/git/ -run TestParse -v` → all pass.

### Step 2: Integration tests for the git Service against a temp repo

Create `internal/git/service_test.go` (or extend if it exists from plan 002).
Use a helper that builds a throwaway git repo in `t.TempDir()`:

```go
func newTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "test@example.com")
	run("config", "user.name", "Test")
	run("config", "commit.gpgsign", "false")
	return dir
}
```

`Service` runs git in the process CWD, so tests must `t.Chdir(dir)` (Go 1.24+) or
`os.Chdir` with restore. **Go here is 1.22**, so `t.Chdir` is NOT available — use:
```go
old, _ := os.Getwd(); os.Chdir(dir); t.Cleanup(func() { os.Chdir(old) })
```
Note: `os.Chdir` makes these tests non-parallel — do NOT call `t.Parallel()` in them.

Cover:
- Commit a file, modify it, `GetDiff(DiffTypeUnstaged)` → one `FileDiff` with the
  expected path and additions.
- Stage a change, `GetDiff(DiffTypeStaged)` → reflects staged content.
- An untracked file appears in `DiffTypeUnstaged`/`DiffTypeAll` as
  `FileStatusAdded` (exercises `getUntrackedFiles` + `getUntrackedFileDiff`).
- `GetFileDiff("nonexistent", DiffTypeAll)` → error "file not found in diff".

**Verify**: `go test ./internal/git/ -v` → all pass.

### Step 3: Review store tests (including concurrency)

Create `internal/review/store_test.go`. Cover:
- `AddComment` assigns a non-empty `ID` and non-zero `CreatedAt`; the comment is
  retrievable via `GetAllComments`.
- `GetComments(file)` filters by file.
- `DeleteComment(id)` returns true and removes; deleting a missing id returns false.
- Concurrency: spawn N goroutines each calling `AddComment`, wait, assert
  `len(GetAllComments()) == N` and all IDs unique. Run under `-race`.

**Verify**: `go test -race ./internal/review/ -v` → all pass, no race report.

### Step 4: Handler tests with httptest

Create `internal/handlers/handlers_test.go`. Construct a `Handler` with a real
`review.NewStore()` and a `git.NewService()` pointed at a temp repo (reuse the
helper pattern from Step 2; `os.Chdir` into it). Use `httptest.NewRecorder` and
`http.NewRequest`. For routes with mux vars, wrap with a `mux.Router` so
`mux.Vars` resolves, e.g.:

```go
r := mux.NewRouter()
r.HandleFunc("/api/review/comment/{id}", h.DeleteComment).Methods("DELETE")
```

Cover:
- `POST /api/review/comment` with a valid JSON body → 200 and the returned JSON
  has a generated `id`; `GET /api/review/comments` then returns it.
- `DELETE /api/review/comment/{id}` for an existing id → 204; for a missing id → 404.
- `POST /api/review/comment` with malformed JSON → 400.
- `GET /api/diff` against the temp repo → 200 with a JSON object containing
  `files` and `type`.

**Verify**: `go test ./internal/handlers/ -v` → all pass.

### Step 5: Full suite + coverage snapshot

**Verify**:
- `cd web && npm run build && cd .. && go test -race ./...` → all pass.
- `go test -cover ./internal/...` → prints coverage; record the numbers in the
  status row note (target: parser and store > 70%).

## Test plan

(This plan *is* the test plan.) New files: `parser_test.go`, `service_test.go`,
`store_test.go`, `handlers_test.go`. No existing test to model after — these
become the patterns future tests follow.

## Done criteria

ALL must hold:

- [ ] `go test -race ./...` exits 0 (web built first)
- [ ] `find internal -name '*_test.go'` lists the 4 new files
- [ ] `go test -cover ./internal/git/ ./internal/review/` shows >0% (target >70% each)
- [ ] `go vet ./...` exits 0
- [ ] No non-test source files modified (`git status` shows only `_test.go` + plans/README.md)
- [ ] `plans/README.md` status row for 003 updated (include coverage numbers)

## STOP conditions

Stop and report if:
- A test cannot capture current behavior because the code appears genuinely buggy
  (e.g. parser mis-numbers lines). Record the discrepancy as a finding; do NOT
  change source to make a test pass — that belongs to a fix plan.
- `git` is unavailable in the environment (integration tests need it) — report;
  parser_test.go and store_test.go still run without git.
- Tests are flaky due to `os.Chdir` races — ensure no `t.Parallel()` in
  CWD-dependent tests.

## Maintenance notes

- Reviewer: confirm tests assert behavior, not implementation details, and that
  no test depends on the host's real git config (we set user.email/name and
  disable gpg signing in the temp repo).
- Watcher tests deferred: the 1s polling loop is timing-sensitive. If the watcher
  is later refactored to fsnotify (a direction option), add tests then.
- These tests are the safety net for plans 002, 005, 006 — run them before/after
  those changes.
</content>
