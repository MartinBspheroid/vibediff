# Product

## Register

product

## Users

Developers reviewing their own local Git changes before committing or pushing. They run
`vibediff` in a repo, the tool opens in the browser, and they read diffs and leave review
comments that print to the terminal. Context: focused, in-flow code review on their own
machine — often alongside an editor and terminal.

## Product Purpose

A local, zero-cloud Git diff viewer. A single Go binary serves a React SPA on
`localhost:8888`, reads `git` diffs from the working directory, and lets the user add
review comments. Success: reviewing a local diff feels as fluent as a GitHub PR, but fully
offline and instant, with no data leaving the machine.

## Brand Personality

Precise, fast, familiar. Reads like a developer tool that respects the user's attention:
GitHub-fluent so there's nothing to learn, quiet chrome, content-first.

## Anti-references

Not a marketing surface. No hero sections, gradients, decorative motion, or display fonts.
Nothing that calls attention to the tool instead of the diff.

## Design Principles

- **GitHub-fluent.** Match the conventions of the tool developers already use; earned
  familiarity over novelty.
- **Content-first.** Chrome stays quiet; the diff is the interface.
- **Fast and responsive.** Huge diffs must never freeze the UI — defer, collapse, virtualize
  before they hurt.
- **Keyboard-native.** Every primary action reachable without the mouse.

## Accessibility & Inclusion

WCAG 2.1 AA. Every interactive control has a visible `focus-visible` ring and an accessible
name; respect `prefers-reduced-motion`; maintain contrast in both light and dark themes.
