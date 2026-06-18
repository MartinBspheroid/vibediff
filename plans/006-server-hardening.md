# Plan 006: Server hardening — body limits, comment validation, error sanitization, WS origin

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the result. Honor STOP conditions. Update the status row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- main.go internal/handlers/`
> If changed, compare excerpts to live code; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (CI), 002 (reuses the repo-path validator), ideally 003
  (handler tests as the net)
- **Category**: security
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

A cluster of small, confirmed robustness gaps. Individually minor for a local
tool; together they're the difference between "works on my machine" and
production-grade — and they matter the moment someone runs `-host 0.0.0.0`:
- No request body size limit on `AddComment` → memory-exhaustion DoS via a huge
  JSON body.
- No validation on comment fields → negative/garbage line numbers, unbounded
  `Content`, arbitrary `File` stored verbatim.
- Handlers return raw `err.Error()` to clients → leaks filesystem paths and git
  stderr.
- WebSocket `CheckOrigin` returns `true` for all origins → cross-site WebSocket
  hijacking when not localhost-bound.
- A duplicated debug-flag check (dead code) in `websocket.go`.

## Current state

`internal/handlers/handlers.go:83-103` — `AddComment` decodes the body with no
size cap and no validation:
```go
func (h *Handler) AddComment(w http.ResponseWriter, r *http.Request) {
	var comment review.Comment
	if err := json.NewDecoder(r.Body).Decode(&comment); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	h.reviewStore.AddComment(&comment)
	...
}
```
`Comment` fields (review/store.go:10-18): `File string`, `Line int`, `LineEnd int`,
`Side string`, `Content string`.

Raw error leaks: `handlers.go:37,49,76,86,144,160` return `err.Error()` or
`fmt.Sprintf("...: %v", err)` to the client. `service.go:106` wraps git stderr
into the error.

`internal/handlers/websocket.go:13-18` — `CheckOrigin: func(r) bool { return true }`.

`internal/handlers/websocket.go:127-133` — duplicated `if os.Getenv("VIBEDIFF_DEBUG") == "true"`
nested inside itself (dead inner check).

`main.go:153-158` — server has Read/Write timeouts but no `MaxHeaderBytes`.

**Conventions**: standard library only; errors wrapped with `%w`; debug logging
gated on `os.Getenv("VIBEDIFF_DEBUG") == "true"`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build (web first) | `cd web && npm run build && cd .. && go build ./...` | exit 0 |
| Test | `go test ./internal/handlers/...` | all pass |
| Vet | `go vet ./...` | exit 0 |

## Scope

**In scope**:
- `internal/handlers/handlers.go` (body limit + validation + error sanitization)
- `internal/handlers/websocket.go` (origin check + remove dup debug check)
- `main.go` (add `MaxHeaderBytes`)
- `internal/handlers/handlers_test.go` (extend/create — validation + limit cases)

**Out of scope**:
- The path-traversal fix itself (plan 002 owns it). Here you only reuse its
  validator for the comment `File` field (Step 2).
- Reworking the review store API.

## Git workflow

- Branch: `advisor/006-server-hardening`
- Commit: `fix(security): limit request bodies, validate comments, sanitize errors, restrict ws origin`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Limit the request body in AddComment

Wrap the body before decoding and disallow unknown fields:
```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields()
if err := dec.Decode(&comment); err != nil {
	http.Error(w, "invalid request body", http.StatusBadRequest)
	return
}
```
Also set `MaxHeaderBytes: 1 << 20` in the `http.Server` struct in `main.go:153-158`.

**Verify**: `cd web && npm run build && cd .. && go build ./...` → exit 0.

### Step 2: Validate comment fields

After decoding, reject invalid comments with 400 (generic messages). Rules:
- `Content` non-empty after `strings.TrimSpace`, and length ≤ a cap (e.g. 10000).
- `Line >= 1`; if `LineEnd != 0` then `LineEnd >= 1`.
- `File` non-empty and a safe repo-relative path. Reuse plan 002's validator:
  if plan 002 exposed `git.ValidateRepoPath` (or similar), call it; otherwise
  reject `File` containing `..` segments or a leading `/` as a minimal check and
  note the dependency in the status row.

Return `http.Error(w, "invalid comment", http.StatusBadRequest)` on any failure
(no field-specific internal detail).

**Verify**: `go test ./internal/handlers/...` → passes after Step 5 tests added.

### Step 3: Sanitize error responses

Replace client-facing `err.Error()` / `%v` in `handlers.go` (lines 37,49,76,86,
144,160) with generic messages, and log the detail server-side instead:
```go
log.Printf("get diff: %v", err)
http.Error(w, "internal error", http.StatusInternalServerError)
```
Keep 4xx vs 5xx status codes as they are. Add `"log"` to imports if needed.
Do NOT echo git stderr or file paths to the client.

**Verify**: `go build ./... && go vet ./...` → exit 0.

### Step 4: Restrict WebSocket origin + remove dup debug check

In `websocket.go`, replace the always-true `CheckOrigin` with a same-origin /
localhost check. Allow requests whose `Origin` host matches the request `Host`,
and allow empty Origin (non-browser clients / same-origin some browsers omit):
```go
CheckOrigin: func(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return u.Host == r.Host
},
```
Add `"net/url"` to imports. Then remove the duplicated inner
`if os.Getenv("VIBEDIFF_DEBUG") == "true"` at websocket.go:129 (flatten to a
single check).

**Verify**: `go build ./... && go vet ./...` → exit 0. Manually confirm the
local app still establishes a WebSocket (same-origin) after this change — or rely
on plan 004's e2e live-update journey.

### Step 5: Tests

Extend/create `internal/handlers/handlers_test.go` (coordinate with plan 003):
- `AddComment` with empty `Content` → 400; with `Line = 0`/negative → 400; with
  `File` containing `../` → 400.
- `AddComment` with a >1 MiB body → 400 (MaxBytesReader triggers).
- A handler whose underlying service errors returns a generic message body (no
  path/stderr substring) — assert the response body does NOT contain a filesystem
  path or "git command failed".
- A valid comment still succeeds (200) and is retrievable.

**Verify**: `go test ./internal/handlers/... -v` → all pass.

## Test plan

Cases above in `handlers_test.go`. If plan 003 created it, extend; else create
following the `httptest` + `mux.Router` pattern described in plan 003 Step 4.

## Done criteria

ALL must hold:

- [ ] `cd web && npm run build && cd .. && go build ./...` exits 0
- [ ] `go vet ./...` exits 0
- [ ] `go test ./internal/handlers/...` passes, including new validation/limit tests
- [ ] `grep -n "return true" internal/handlers/websocket.go` no longer matches the CheckOrigin body
- [ ] No client-facing `err.Error()` remains in `handlers.go` (`grep -n "err.Error()" internal/handlers/handlers.go` only in `writeJSON`'s internal path if unavoidable — prefer none)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report if:
- The same-origin WebSocket check breaks the local app's live updates (e.g. the
  browser sends an Origin that doesn't match Host because of the port). Report
  the exact Origin/Host seen; the fix may be to compare hostnames allowing the
  configured port.
- `DisallowUnknownFields` rejects the frontend's real payload (the frontend sends
  `{file, line, content, lineEnd}`; `Comment` also has `id`, `side`, `createdAt`
  — `id`/`createdAt` are server-set and should NOT be sent; if the frontend does
  send extras, relax to not using `DisallowUnknownFields` and note it).
- Plan 002's validator isn't available and the minimal `..`/leading-`/` check
  feels insufficient — report and proceed with the minimal check.

## Maintenance notes

- Reviewer: confirm no error path leaks internal detail; confirm body limit is on
  every POST (currently only `AddComment` accepts a body).
- If new POST endpoints are added, apply `MaxBytesReader` + validation uniformly.
- The WS origin check assumes browser same-origin; revisit if a legitimate
  cross-origin client is ever needed (make it configurable then).
</content>
