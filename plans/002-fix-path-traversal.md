# Plan 002: Eliminate arbitrary file read (path traversal) in file endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- internal/git/ internal/handlers/`
> If those changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (CI provides the gate; not strictly required to start)
- **Category**: security
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

VibeDiff serves file contents based on **unvalidated, user-supplied paths**, so
a request can read any file the server process can access:

- `GET /api/file?path=../../../../etc/passwd` → `GetFileContent` →
  `git show HEAD:../../../../etc/passwd` fails, then falls back to
  `exec.Command("cat", filePath)` which happily reads `/etc/passwd`.
- `GET /api/diff/{file}/full` and `GET /api/diff/{file}` accept a `{file:.+}`
  path param used to match untracked files and `cat` them.

The README promises "no data leaves your computer" — but with `-host 0.0.0.0`
(a supported flag, main.go:60) this is a remote arbitrary-file-read. Even on
localhost, any webpage in the user's browser can issue these GETs. This is the
single highest-severity bug found.

## Current state

`internal/handlers/handlers.go:151-168` — `GetFileContent`:
```go
func (h *Handler) GetFileContent(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "Missing file path", http.StatusBadRequest)
		return
	}
	content, err := h.gitService.GetFileContent(filePath)
	...
}
```

`internal/git/service.go:121-133` — `GetFileContent` (the dangerous `cat` fallback):
```go
func (s *Service) GetFileContent(filePath string) (string, error) {
	content, err := s.runGitCommand("show", fmt.Sprintf("HEAD:%s", filePath))
	if err != nil {
		// If not in HEAD, try to read from filesystem
		output, err := exec.Command("cat", filePath).Output()
		if err != nil {
			return "", fmt.Errorf("failed to read file: %w", err)
		}
		return string(output), nil
	}
	return content, nil
}
```

`internal/git/service.go:195-201` — `getUntrackedFileDiff` also uses `cat`:
```go
content, err := exec.Command("cat", filepath).Output()
```

`internal/handlers/handlers.go:61-67` and `129-135` — `GetFileDiff` /
`GetFullFileWithDiff` unescape `vars["file"]` with no validation before passing
to git service.

**Repo conventions to match**: errors are returned as `fmt.Errorf("...: %w", err)`
(see service.go throughout). Package `git` has no existing helpers file — add
one. Standard library only; no new deps (go.mod has just gorilla/mux + websocket).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build web (for embed) | `cd web && npm run build && cd ..` | creates web/dist |
| Typecheck/compile | `go build ./...` | exit 0 |
| Test | `go test ./internal/git/...` | all pass |
| Vet | `go vet ./...` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `internal/git/service.go` (modify: replace `cat` with sandboxed reads; add path validation)
- `internal/git/path.go` (create: `safeRepoPath` helper)
- `internal/git/path_test.go` (create: unit tests for the helper)
- `internal/git/service_test.go` (create OR extend if plan 003 ran first — coordinate via the file's existing tests)

**Out of scope** (do NOT touch):
- `internal/handlers/handlers.go` request shapes / routes — validation lives in
  the `git` service layer so every caller is protected uniformly. (You MAY leave
  handlers untouched entirely.)
- The `diffTarget` handling (service.go:33-34) — operator-controlled CLI input,
  not request input. You may add a `--` separator (Step 3) but do not gate it.
- WebSocket, watcher, review packages.

## Git workflow

- Branch: `advisor/002-fix-path-traversal`
- Commit message: `fix(security): reject path traversal and drop cat fallback for file reads`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a path-validation helper

Create `internal/git/path.go`. The helper resolves a user-supplied path against
the current working directory (the git repo root the server runs in) and rejects
anything that escapes it or is absolute.

```go
package git

import (
	"fmt"
	"path/filepath"
	"strings"
)

// safeRepoPath validates that userPath refers to a file inside the repository
// working directory (the process's current working directory). It returns the
// cleaned, repo-relative path on success, or an error if the path is absolute,
// escapes the repo via "..", or cannot be resolved.
func safeRepoPath(userPath string) (string, error) {
	if userPath == "" {
		return "", fmt.Errorf("empty path")
	}
	if filepath.IsAbs(userPath) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}

	root, err := filepath.Abs(".")
	if err != nil {
		return "", fmt.Errorf("cannot resolve repo root: %w", err)
	}

	clean := filepath.Clean(userPath)
	abs := filepath.Join(root, clean)

	// Ensure the resolved path is within root (defends against ../ escapes).
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes repository root")
	}
	return rel, nil
}
```

**Verify**: `go build ./internal/git/` → exit 0

### Step 2: Use the helper and replace `cat` with `os.ReadFile`

In `internal/git/service.go`:

1. Add `"os"` to the imports (it is not currently imported).
2. Rewrite `GetFileContent` (lines 121-133) to validate first and use
   `os.ReadFile` instead of shelling out to `cat`:

```go
func (s *Service) GetFileContent(filePath string) (string, error) {
	safe, err := safeRepoPath(filePath)
	if err != nil {
		return "", fmt.Errorf("invalid file path: %w", err)
	}
	// Prefer the committed version (HEAD); fall back to the working tree.
	content, err := s.runGitCommand("show", "HEAD:"+safe)
	if err == nil {
		return content, nil
	}
	output, readErr := os.ReadFile(safe)
	if readErr != nil {
		return "", fmt.Errorf("failed to read file: %w", readErr)
	}
	return string(output), nil
}
```

3. Rewrite the `cat` call in `getUntrackedFileDiff` (lines 195-201) to validate
   and use `os.ReadFile`:

```go
func (s *Service) getUntrackedFileDiff(filepath string, contextLines int) (*FileDiff, error) {
	safe, err := safeRepoPath(filepath)
	if err != nil {
		return nil, fmt.Errorf("invalid untracked file path: %w", err)
	}
	content, err := os.ReadFile(safe)
	if err != nil {
		return nil, fmt.Errorf("failed to read untracked file %s: %w", safe, err)
	}
	// ... rest of the function unchanged (uses `content` and `safe`/`filepath` for FileDiff.Path)
```
Keep the original `filepath` value for `FileDiff.Path` so the UI still shows the
repo-relative name (it already is repo-relative — git ls-files returns relative
paths). Use `safe` for the read.

**Verify**: `cd web && npm run build && cd .. && go build ./...` → exit 0
(web build needed because main.go embeds web/dist).

### Step 3 (minor, defense-in-depth): separate git options from paths

In `GetFileContent`'s `git show` the `HEAD:` prefix already disambiguates a rev
from a flag, so no `--` is needed there. No change required unless Step 2 left a
raw path as the first git arg anywhere — it did not. Skip if nothing applies.

### Step 4: Write tests for the helper and the read path

Create `internal/git/path_test.go`:

```go
package git

import (
	"path/filepath"
	"testing"
)

func TestSafeRepoPath(t *testing.T) {
	ok := []string{"main.go", "internal/git/service.go", "./README.md", "a/b/c.txt"}
	for _, p := range ok {
		if _, err := safeRepoPath(p); err != nil {
			t.Errorf("expected %q to be allowed, got %v", p, err)
		}
	}
	bad := []string{"", "../etc/passwd", "../../secret", "/etc/passwd", "a/../../b"}
	for _, p := range bad {
		if _, err := safeRepoPath(p); err == nil {
			t.Errorf("expected %q to be rejected", p)
		}
	}
	// A path that cleans back inside root is allowed.
	if got, err := safeRepoPath("a/../main.go"); err != nil || got != "main.go" {
		t.Errorf("a/../main.go => (%q, %v), want (main.go, nil)", got, err)
	}
	_ = filepath.Separator
}
```

If `internal/git/service_test.go` already exists (plan 003), add a test there
that `GetFileContent("../../../etc/passwd")` returns an error and reads nothing;
otherwise create a minimal `service_test.go` with just that case.

**Verify**: `go test ./internal/git/...` → all pass, including the new tests.

## Test plan

- `path_test.go`: allowed paths (relative, nested, `./`-prefixed), rejected
  paths (empty, `../` escape, absolute, mid-path escape), and the
  cleans-back-inside case.
- A traversal regression test: `GetFileContent("../../../../etc/passwd")` returns
  a non-nil error (model after any handler/service test in plan 003).
- Verification: `go test ./internal/git/...` → all pass.

## Done criteria

ALL must hold:

- [ ] `grep -rn "exec.Command(\"cat\"" internal/` returns **no matches**
- [ ] `internal/git/path.go` exists with `safeRepoPath`
- [ ] `go build ./...` exits 0 (after `cd web && npm run build`)
- [ ] `go test ./internal/git/...` passes, including new path tests
- [ ] `go vet ./...` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report (do not improvise) if:
- Legitimate diff viewing breaks because git returns paths the helper rejects
  (e.g. the tool is run from a subdirectory and paths are repo-root-relative
  rather than CWD-relative). If so, report — the fix is to anchor `root` at the
  git toplevel (`git rev-parse --show-toplevel`) instead of `.`, which is a
  design decision to confirm with the operator.
- Removing the `cat` fallback changes behavior for symlinked files inside the
  repo in a way that breaks an existing test.
- Any in-scope excerpt above does not match the live code (drift).

## Maintenance notes

- Reviewer should confirm `safeRepoPath` is called on **every** path that reaches
  the filesystem or `git show`. If a new file-serving endpoint is added later, it
  MUST route through this helper.
- Plan 006 reuses `safeRepoPath` to validate the `file` field of incoming review
  comments — keep the helper exported-or-package-visible accordingly (it is
  package-visible; 006 lives in a different package, so if 006 needs it, expose a
  thin exported wrapper `ValidateRepoPath` at that time).
- If the project later supports running against a repo path argument (not just
  CWD), the `root` anchor must follow that.
</content>
