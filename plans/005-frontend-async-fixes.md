# Plan 005: Fix frontend async hazards (WS timeout leak, fetch race, silent error)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. Honor STOP conditions. Update the status row
> in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- web/src/hooks/`
> If changed, compare the excerpts below to live code; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 001 (CI). Strongly benefits from 004 (e2e) and adding the
  hook unit tests below as the regression net.
- **Category**: bug
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

Three confirmed async bugs in the React hooks degrade reliability:
1. **WebSocket timeout leak** — `setTimeout(..., 300)` fired per message is never
   tracked or cleared, so callbacks fire after unmount and accumulate.
2. **`useDiff` fetch race** — switching diff type quickly can let a slow earlier
   request overwrite the newer one's data (wrong diff shown).
3. **`useComments` silent load failure** — a failed initial fetch is swallowed;
   the UI shows "no comments" indistinguishably from a real failure.

## Current state

`web/src/hooks/useWebSocket.ts:50-65` — untracked timeout:
```ts
} else if (data.type === 'file_changed' || ...) {
  setTimeout(() => { onUpdateRef.current() }, 300)   // never cleared
}
```
The effect's cleanup (lines 92-99) clears `reconnectTimeoutRef` and closes the
socket, but NOT these per-message timeouts.

`web/src/hooks/useDiff.ts:17-41` — `fetchDiff` depends on `type`; the initial
effect (line 39-41) and `refetch` (44-46) call it, but there is no
`AbortController` and no guard that the response still matches the current `type`.

`web/src/hooks/useComments.ts:16-30` — initial fetch only `setComments` when
`response.ok`; failures land in `catch` → `console.error` only, no error state.

**Conventions**: hooks use refs for mutable non-render state (see
`useWebSocket.ts:9-12`); `useCallback`/`useEffect` with explicit deps; TS strict
(no `any`). Tests use Vitest + Testing Library (`web/src/hooks/useComments.test.ts`
is the model). `npm run lint` runs `eslint . --max-warnings 0` — zero warnings allowed.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `cd web && npx tsc -b` | exit 0 |
| Lint | `cd web && npm run lint` | exit 0, no warnings |
| Test | `cd web && npm run test` | all pass |

## Scope

**In scope**:
- `web/src/hooks/useWebSocket.ts`, `web/src/hooks/useDiff.ts`, `web/src/hooks/useComments.ts`
- `web/src/hooks/useWebSocket.test.ts` (create), `web/src/hooks/useDiff.test.ts` (create)
- `web/src/hooks/useComments.test.ts` (extend — add init-failure case)
- Any component consuming `useComments` IF you expose a new `error` field and
  choose to surface it (see Step 3) — keep that change minimal and additive.

**Out of scope**:
- The DiffLine memoization / virtual-scrolling performance items (separate concern).
- Backend. The reconnection/backoff logic in `useWebSocket` (works; don't rework).

## Git workflow

- Branch: `advisor/005-frontend-async-fixes`
- Commit: `fix(web): clear ws message timeouts, guard diff fetch race, surface comment load error`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Track and clear WebSocket message timeouts

In `useWebSocket.ts`, hold pending timeout ids and clear them on cleanup and on
close. Add a ref `const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())`.
In `onmessage`, capture the id, add to the set, and remove it when it fires:
```ts
const id = setTimeout(() => { pendingTimeoutsRef.current.delete(id); onUpdateRef.current() }, 300)
pendingTimeoutsRef.current.add(id)
```
In the effect cleanup (and in `ws.onclose` before reconnecting is fine to leave),
clear all: `pendingTimeoutsRef.current.forEach(clearTimeout); pendingTimeoutsRef.current.clear()`.

**Verify**: `cd web && npx tsc -b && npm run lint` → exit 0.

### Step 2: Guard the `useDiff` fetch race with AbortController

In `useDiff.ts`, create an `AbortController` per `fetchDiff` invocation, pass its
`signal` to `fetch`, and ignore `AbortError`. Abort the previous request when a
new one starts (store the controller in a `useRef`) and on unmount. Only call
`setData`/`setError` if not aborted. Keep the `loading`/`error` semantics intact.
Suggested shape:
```ts
const abortRef = useRef<AbortController | null>(null)
const fetchDiff = useCallback(async (showLoading = true) => {
  abortRef.current?.abort()
  const ac = new AbortController(); abortRef.current = ac
  try {
    if (showLoading) setLoading(true)
    const res = await fetch(`/api/diff?type=${type}`, { signal: ac.signal })
    if (!res.ok) throw new Error('Failed to fetch diff')
    const result = await res.json() as DiffResult
    setData(result); setError(null)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    setError(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    if (showLoading && !ac.signal.aborted) setLoading(false)
  }
}, [type])
```
Add `useEffect(() => () => abortRef.current?.abort(), [])` for unmount.

**Verify**: `cd web && npx tsc -b && npm run lint` → exit 0.

### Step 3: Surface the comment load failure

In `useComments.ts`, add an `error` state, set it in the init fetch's `catch`
and when `!response.ok`, and add `error` to `UseCommentsReturn`. Surfacing it in
the UI is optional but preferred: if a consumer (e.g. `App.tsx` or `DiffViewer`)
renders comments, show a small inline notice when `error` is set. Keep it minimal;
do not redesign anything (that's the `impeccable` skill's job, not this plan).

**Verify**: `cd web && npx tsc -b && npm run lint` → exit 0.

### Step 4: Tests

- `useWebSocket.test.ts` (create): mock `WebSocket` and use fake timers
  (`vi.useFakeTimers()`); assert that a `file_changed` message schedules
  `onUpdate` after 300ms, and that after unmount the pending timeout does NOT
  call `onUpdate` (advance timers post-unmount). Model structure after
  `useComments.test.ts`.
- `useDiff.test.ts` (create): mock `fetch`; simulate two rapid `type` changes
  where the first resolves last, assert final `data` corresponds to the second
  request (or that the first is aborted). Mock `fetch` to honor `signal`.
- `useComments.test.ts` (extend): add a case where the init fetch returns
  `{ ok: false }` and assert `error` is set and `comments` stays `[]`.

**Verify**: `cd web && npm run test` → all pass, including new tests.

## Test plan

New: `useWebSocket.test.ts`, `useDiff.test.ts`. Extended: `useComments.test.ts`.
Cases: ws timeout cleared on unmount; diff race resolves to latest; comment init
error surfaced. Pattern source: existing `useComments.test.ts` / `useRangeSelection.test.ts`.

## Done criteria

ALL must hold:

- [ ] `cd web && npx tsc -b` exits 0
- [ ] `cd web && npm run lint` exits 0 with no warnings
- [ ] `cd web && npm run test` passes, including the 3 new/extended test areas
- [ ] `grep -n "setTimeout" web/src/hooks/useWebSocket.ts` shows the id is added to the tracking set
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report if:
- Adding AbortController breaks an existing test or changes the `useDiff` public
  return shape unexpectedly.
- Surfacing the comment error requires touching more than one consumer component
  or any redesign — in that case, expose the `error` field only and leave UI
  wiring as a noted follow-up.
- Any excerpt above doesn't match live code (drift).

## Maintenance notes

- `FullFileModal` has the same fetch-on-unmount hazard (CORRECTNESS-07); not in
  scope here — note it as a follow-up to fix with the same AbortController pattern.
- Reviewer: verify timers are cleared on BOTH unmount and socket close, and that
  no `onUpdate` fires after unmount in the test.
</content>
