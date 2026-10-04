# UI/UX workflow — stack-aware

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

## UI/UX workflow — stack-aware

**Wide latitude in how the UI is made, no latitude in whether it came out well.** The agent may reach
for any tool or technique below — or none of them. What it may not do is call UI done before the
**real built page has been observed, compared with the design context, critiqued, corrected and
exercised end-to-end**. A single prompt-to-code pass is not a design loop.

### Sources of truth

`design-system.md` (palette, type, components, motion) and `user-stories.md` are the design contract
for this page today; there is no `PRODUCT.md` / `DESIGN.md` yet — `$impeccable teach` writes them on
first use (see [Start here](../../AGENTS.md#start-here)). If a hosted generator ever produces its own `DESIGN.md`,
it never lands on the root file: save it under `docs/design/` with an explicit name and bring over
only the decisions you keep.

### Creative latitude — restraint is the ceiling here, not the floor

This product inverts the usual "push past the defaults" advice. `design-system.md` states the visual
concept in one line: **"calm, utilitarian, vault-like … never playful, never marketed"** — a page that
handles seed phrases and recovery keys has to read as trustworthy, not impressive. Impeccable's
`quieter`, `distill`, `typeset` and `audit` are the tools that fit this brief; `bolder`, `delight`,
`animate` and `overdrive` are not a default here — reach for them only for a deliberate, written-down
exception. Two conditions still hold, no exceptions: every visual value comes from a `design-system.md`
token (a value the system lacks is **added to the system first**, never a magic number), and motion
honours `prefers-reduced-motion` and is never required to finish a flow. **Generic is still a defect**
here too — an unstyled `<button>` or default focus ring fails "does this earn trust" exactly like a
gaudy one would; the fix is deliberate plainness, not more expression.

### Explore wide, then converge

For a new screen or a real redesign of the existing one, render two or three directions **within the
palette above** (density, spacing, the share-strip treatment) before settling — the range here is
restraint vs. slightly-less-restraint, not one layout style vs. another. Compare against
`design-system.md`, pick one, and write in the PR why it won. A copy or wording change skips this step.

### Toolbox — capabilities, not dependencies

The agent chooses; none of these is a project dependency, and a missing one never blocks work.

**Privacy boundary:** never send source, screenshots or a running preview of this page to a **hosted**
service (Stitch, 21st, Figma's remote server, Gemini) without explicit approval. This governs the
agent's own tools, not the shipped artifact — the zero-network rule for `dist/index.html` itself is
separate and absolute (see [Working rules](../../AGENTS.md#working-rules)).

**Coexistence:** one browser driver per session (Chrome DevTools MCP *or* Playwright MCP).

#### Web

| Role | Default | Reach for instead when… | Runs |
| --- | --- | --- | --- |
| Direction and taste | Impeccable (`quieter`, `distill`, `critique`, `typeset`, `audit`) — the restrained end of the toolbox | `bolder` / `delight` / `animate` only for a deliberate, written-down exception to "never playful" | local |
| Components | none — there is no component library or registry; hand-author semantic HTML/CSS against the `design-system.md` tokens | — | — |
| Observe the real page | Chrome DevTools MCP (`chrome-devtools`) or Playwright MCP (`playwright`), pointed at the **built `dist/index.html` opened over `file://`** — there is no dev server and no `localhost` | Playwright MCP to script a multi-step flow before writing it as a committed spec | local |
| UX and accessibility audit | `web-design-guidelines` + Impeccable `audit` | — | local, fetches the ruleset |
| External references | screenshots the user supplies | Stitch MCP, 21st MCP, Figma MCP — **hosted, ask first** | hosted |
| Deterministic gate | the committed Playwright suite — see [E2E (Playwright) — mandatory](e2e.md#e2e-playwright--mandatory) | — | local |

### The loop

```text
design-system.md + user-stories.md
                ↓
   explore wide only for a new/redesigned screen (2–3 restrained directions)
                ↓
        build: hand-authored HTML/CSS/TS against the tokens
                ↓
   observe the REAL built dist/index.html over file:// (pixels + semantics)
                ↓
 critique (Impeccable: quieter/distill/audit) → correct → observe again  ← repeat until it holds
                ↓
           polish → offline check re-run → a11y audited
                ↓
      deterministic E2E on the real artifact (Playwright)
```

**Never accept the first render.** Inspect the primary screen plus its empty/error/disabled/validation
states (invalid share, wrong threshold, failed recombination), both themes (light-first, dark via
`prefers-color-scheme`, no toggle — see `design-system.md`), keyboard/focus behaviour, contrast, and
the share-strip's selectable-field semantics.

### Web / vanilla TypeScript, no framework

- **Components:** there is no registry to search — hand-roll HTML/CSS directly against the tokens in
  `design-system.md`. `src/ui/main.ts` is the only file that touches the DOM; keep it that way (see
  [Design principles — SOLID](design-principles.md#design-principles--solid-applied-with-judgement)).
- **Observe what shipped, not what the source implies:** open the **built** `dist/index.html` (never
  `src/index.html`) — screenshots, DOM/accessibility tree, computed layout, console — and confirm the
  network panel stays empty, per the zero-network invariant.
- **Chrome DevTools and Playwright MCP observe; the Playwright suite proves.** Neither MCP replaces the
  committed E2E spec described in [E2E (Playwright) — mandatory](e2e.md#e2e-playwright--mandatory).

### UI done means observed, not generated

Before calling UI work complete, verify all of these that apply:

- the **built** `dist/index.html` was opened and inspected after the final code change, not only
  `src/`;
- for a new screen or a real redesign, directions were explored within the restrained palette and the
  choice is written down;
- both themes were checked (light-first, dark via `prefers-color-scheme`, no toggle);
- empty/error/disabled/validation states were seen in the browser, not inferred from source;
- keyboard/focus and the share-strip's selectable-field behaviour are usable, and
  `prefers-reduced-motion` is honoured;
- every new value exists as a token in `design-system.md`;
- the result was compared against `design-system.md`, then critiqued and polished;
- the deterministic E2E layer is green (the committed Playwright suite) and the reload-clears-
  everything / zero-network invariants were not broken — see
  [E2E (Playwright) — mandatory](e2e.md#e2e-playwright--mandatory).
