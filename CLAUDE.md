# CLAUDE.md

Guidance for AI agents and new contributors working in this repo.

## What this is

VibeDiff is a local Git diff viewer: a single Go binary serves a React SPA (with
embedded assets) on `localhost:8888`, reads `git` diffs from the current working
directory, and lets you add review comments that print to the terminal (text) or
dump as JSON on exit. No cloud, no data leaves the machine.

## Layout

- `main.go` — entry point: flags, routes (Gorilla Mux), embeds `web/dist`, graceful shutdown.
- `internal/git/` — git command orchestration (`service.go`), diff parsing (`parser.go`),
  shared types (`types.go`), repo-path validation (`path.go`).
- `internal/handlers/` — HTTP handlers (`handlers.go`) and the WebSocket hub (`websocket.go`).
- `internal/review/` — in-memory review-comment store (`store.go`, mutex-guarded).
- `internal/watcher/` — polls `git status` and notifies clients over WebSocket.
- `web/src/` — React 19 + TypeScript SPA. Hooks in `hooks/`, components in `components/`,
  Prism syntax highlighting in `utils/prism.ts`, Solar icons in `components/icons.ts`.
- `web/e2e/` — Playwright end-to-end tests that drive the real binary.

## Build / test / lint commands

Backend (Go 1.22):
- `task build` — build web then the binary (`go build -o vibediff .`). The binary
  `//go:embed`s `web/dist`, so **the web app must be built before any Go build/test**.
- `go test -race ./...` — run all Go tests (needs `web/dist` to exist to compile `main.go`;
  use `go test ./internal/...` while iterating to skip the embed).
- `go vet ./...` / `task lint` (golangci-lint).

Frontend (`cd web`):
- `npm run test` — Vitest unit tests (hooks/components).
- `npm run lint` — ESLint (`--max-warnings 0`, strict type-checked rules).
- `npx tsc -b` — typecheck.
- `npm run build` — `tsc -b && vite build`.
- `npm run e2e` — Playwright (needs `vibediff` binary built at repo root and
  `npx playwright install chromium`).

## Conventions

- Go: errors wrapped with `fmt.Errorf("...: %w", err)`; client-facing handler errors are
  generic (details go to `log.Printf`, never to the response); debug logs gated on
  `os.Getenv("VIBEDIFF_DEBUG") == "true"`. Tests use stdlib `testing` + `httptest` and a
  throwaway git repo in `t.TempDir()` (no `t.Parallel()` in CWD-dependent tests; Go 1.22 has no `t.Chdir`).
- React: hooks hold mutable non-render state in refs; strict TS (no `any`, no non-null `!`);
  every button needs a `focus-visible` ring and an accessible name; icons via Solar
  (`unplugin-icons`, compiled into the bundle — no runtime fetch). Match the existing
  GitHub-style design tokens.
- Path safety: any user-supplied path that reaches the filesystem or `git show` must go
  through `git.ValidateRepoPath` / `safeRepoPath`.

## Improvement plans

`plans/` holds prioritized, self-contained implementation plans (see `plans/README.md`
for status). They're written so a fresh agent can execute one end-to-end.
