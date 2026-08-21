# ssss-webpage — Design System

## Visual concept

Calm, utilitarian, vault-like. This page handles seed phrases, master passwords and recovery keys,
so it has to read as sober and trustworthy from the first second — never playful, never marketed.
Every visual decision answers one question: *does this make the user trust the page with a secret?*
The thread running through the UI is the **share strip**: a monospace block where the `sss1-` prefix
is visually separated from the payload, so the user learns to recognise a valid share at a glance.

**Audience:** semi-technical people splitting a high-value secret — crypto holders, sysadmins,
anyone writing down a recovery key for their family. They arrive cautious and they should leave
calmer, not impressed.
**Main theme:** **light-first**. Dark mode exists through `prefers-color-scheme` only — there is
**no toggle**, because a toggle needs persistence and this page persists nothing.
**The unique signature of this UI:** share strings rendered as monospace strips with the `sss1-`
prefix rendered distinctly from the payload it introduces.

---

## Color palette

### Named (6 base values)

| Name         | Light     | Dark      | Role                                              |
| ------------ | --------- | --------- | ------------------------------------------------- |
| **Bg**       | `#f6f7f9` | `#111318` | Root background                                   |
| **Surface**  | `#ffffff` | `#1a1d24` | Surface: section cards, inputs                    |
| **Elevated** | `#ffffff` | `#232733` | Elevated surface: share strips, alerts (light adds a shadow, dark adds lightness) |
| **Primary**  | `#4338ca` | `#a5b4fc` | Brand — CTAs, focus, active links                 |
| **Accent**   | `#047857` | `#6ee7b7` | Successful recovery **only**                      |
| **Muted**    | `#5b6472` | `#9aa3b2` | Secondary text, metadata, placeholders            |

Error sits outside the six: `#b91c1c` in light, `#fca5a5` in dark.

> **Accent is reserved for successful recovery.** It marks the one moment that matters — the secret
> came back intact — and it must never be used decoratively, not on a border, not on a heading, not
> on a hover. If Accent appears anywhere else, the moment stops meaning anything.

### Semantic tokens (CSS custom properties)

Tokens are declared once on `:root` (the light theme) and **redefined inside
`@media (prefers-color-scheme: dark)`**. Nothing in the stylesheet references a raw hex outside these
two blocks. `color-scheme: light dark` is set on `:root` so native form controls, scrollbars and the
default caret follow the same mode.

```css
:root {
  color-scheme: light dark;
  /* Backgrounds */
  --color-bg: #f6f7f9;
  --color-surface: #ffffff;
  --color-elevated: #ffffff;
  --color-hover: #eef0f4;
  /* Brand */
  --color-primary: #4338ca;
  --color-primary-hover: #3730a3;
  /* Accent — successful recovery only */
  --color-accent: #047857;
  /* Text */
  --color-text-1: #14171d; /* primary */
  --color-text-2: #5b6472; /* secondary / Muted */
  --color-text-3: #8a94a3; /* muted / disabled / placeholder */
  /* Borders */
  --color-border: #d8dde5;
  --color-border-hover: #b9c1cd;
  /* State */
  --color-error: #b91c1c;
  --color-focus: #4338ca;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111318;
    --color-surface: #1a1d24;
    --color-elevated: #232733;
    --color-hover: #272c37;
    --color-primary: #a5b4fc;
    --color-primary-hover: #c7d2fe;
    --color-accent: #6ee7b7;
    --color-text-1: #e8ebf0;
    --color-text-2: #9aa3b2;
    --color-text-3: #6f7887;
    --color-border: #2e3441;
    --color-border-hover: #414958;
    --color-error: #fca5a5;
    --color-focus: #a5b4fc;
  }
}
```

---

## Typography

**System font stacks only. Never `@import url(...)`, never a `<link>` to a font host — not Google
Fonts, not any CDN.** The offline invariant forbids it, and the URL scan in `build.mjs` will fail the
build if a font URL ever reaches the stylesheet. There are exactly two families and both are already
on the user's machine:

```css
--font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
```

**Rule:** every share string and every recovered secret renders in `--font-mono`. They are data to be
transcribed by hand, not prose — the user must be able to tell `l` from `1` and `O` from `0`.

| Token             | Size   | LH  | Weight | Font | Use                                     |
| ----------------- | ------ | --- | ------ | ---- | --------------------------------------- |
| `text-display`    | 28px   | 1.2 | 700    | Sans | Page title                              |
| `text-heading`    | 20px   | 1.3 | 600    | Sans | Section card titles, `<summary>`        |
| `text-body`       | 16px   | 1.6 | 400    | Sans | Body copy, labels, buttons              |
| `text-small`      | 13px   | 1.4 | 400    | Sans | Hints, inline errors, metadata          |
| `text-mono`       | 13.5px | 1.5 | 400    | Mono | Share strips, recovered secret, textareas |

---

## Spacing, radius, shadows

- **Spacing:** base 4px scale — `4 / 8 / 12 / 16 / 24 / 32 / 48`. Nothing off-scale.
- **Radius:** `--radius-sm 6px` (controls: inputs, buttons) / `--radius-md 10px` (cards, share strips)
  / `--radius-lg 14px` (top-level sections).
- **Shadows:** one soft step in light mode; in dark mode surfaces go near-flat and separate by border
  instead, because shadows read as mud on a dark background.

```css
--shadow-card: 0 1px 2px rgba(16, 20, 28, 0.06), 0 2px 8px rgba(16, 20, 28, 0.06);
```

```css
@media (prefers-color-scheme: dark) {
  :root {
    --shadow-card: none; /* separation comes from --color-border + --color-elevated */
  }
}
```

---

## Key components

### Section card

The page is three of these stacked: *Split*, *Combine*, and the disclosures. Each is a titled block on
`--color-surface`, `--radius-lg`, 24px padding, `--shadow-card`.

```
┌──────────────────────────────────────────────┐
│ Split a secret                    ← heading  │
│ One-line explanation.             ← small,   │
│                                     text-2   │
│ [ fields … ]                                 │
└──────────────────────────────────────────────┘
```

**States:** default only. Cards never hover, never animate — they are containers, not targets.

### Field (label + control + hint + inline error)

```
Secret                              ← label, body, text-1
┌──────────────────────────────────┐
│                                  │ ← textarea, mono, surface, border
└──────────────────────────────────┘
Plain text. Nothing leaves this page. ← hint, small, text-3
⚠ Enter a secret to split.            ← error, small, --color-error
```

**States:** default (`--color-border`) · hover (`--color-border-hover`) · focus (2px
`--color-focus` outline with 2px offset, border unchanged) · invalid (border `--color-error`,
`aria-invalid="true"`, error text below, wired via `aria-describedby`) · disabled (`--color-text-3`,
no border-hover).

### Primary button

```
┌──────────────────┐
│  Split secret    │  ← body 16, weight 600, radius-sm, 12px/20px padding
└──────────────────┘
```

**States:** default (`--color-primary` bg, white text in light / `--color-bg` text in dark) · hover
(`--color-primary-hover`) · active (same as hover, translate `1px` down) · disabled (`--color-text-3`
bg, `cursor: not-allowed`, no hover) · busy (label swaps to "Splitting…", `aria-busy="true"`,
pointer events off — no spinner, the operation is milliseconds).

### Copy button

Small, secondary, sits at the right edge of each share strip.

```
[ Copy ]   →   [ ✓ Copied ]   →   [ Copy ]
                  (1.5 s)
```

**States:** default (transparent bg, `--color-border`, `--color-text-2`) · hover (`--color-hover`
bg, `--color-border-hover`) · **copied** (checkmark glyph + label swaps to "Copied", border and text
in `--color-accent`, reverts after 1.5 s) · **failed** (label swaps to "Press Ctrl+C", the share text
is programmatically selected, styled with `--color-error`). The state change is announced through the
surrounding `aria-live="polite"` region, so it is never colour-only.

### Share list item

```
┌───────────────────────────────────────────────────┐
│ 1  ┌────────────────────────────────┐   [ Copy ]  │
│    │ sss1-gK3nQx8pV2…c9Fw==         │             │
│    └────────────────────────────────┘             │
└───────────────────────────────────────────────────┘
  ↑                ↑                        ↑
index         readonly textarea         copy button
(mono, text-3)  (mono, text-1, wraps)   (aria-label "Copy share 1")
```

**The share value is a `readonly <textarea>`, not styled markup.** The concept above called for the
`sss1-` prefix to be coloured separately from the payload, and that is not possible inside a form
control. The control won: a textarea is what a user expects to click into, select and copy, it holds
the complete share so a manual Ctrl+C can never take a partial value, and it gives the E2E suite a
real accessible name (`aria-label="Share 1"`) to read the value through. Recognition comes from the
strip itself — elevated surface, mono type, numbered — and from the prefix being the first thing on
every line.

**States:** default · hover (`--color-hover` on the strip) · selected text (native selection,
deliberately not restyled so a manual Ctrl+C looks exactly like the OS expects).

### Alert

One component, two variants, always with an icon glyph **and** text — never colour alone.

- **Error** — `role="alert"`, `--color-error` border and text on `--color-surface`. Used for
  validation failures and unrecoverable combines.
- **Success** — inside the `aria-live="polite"` results region, `--color-accent` border and label.
  This is the only place Accent appears.

### Disclosure (`<details>`)

Collapsed by default, used for **Security notes** and **Licenses**. The `<summary>` is a heading-sized
row with a rotating caret glyph; open state adds `--color-border` above the content.

**States:** closed (default) · hover on summary (`--color-hover`) · focus (`--color-focus` outline
on the summary) · open.

---

## Layout and grid

- **Single column.** `max-width: 720px`, centred with `margin-inline: auto`.
- **Page padding:** 24px; 16px below 480px viewport width.
- **Vertical rhythm:** 32px between section cards, 24px between fields inside a card, 8px between a
  control and its hint.
- **No sidebar, no header nav, no footer links.** The page is one screen with two jobs; anything that
  looks like navigation would imply there is somewhere else to go, and there isn't.
- **No breakpoint system.** A single column at 720px max-width degrades correctly on a phone with the
  padding change above; that is the whole responsive story.

## Motion

- **Two durations only:** `--motion-micro: 80ms` (hover, border, background) and `--motion-fast: 150ms`
  (results appearing, disclosure opening). Nothing slower exists.
- **There is deliberately no dramatic moment.** Sobriety *is* the personality here — a celebratory
  animation on "your secret was recovered" would undercut the seriousness of the thing being handled.
- **Results** fade in over 150ms with a 4px rise (`translateY(4px) → 0`), easing `ease-out`.
- **`prefers-reduced-motion: reduce`** — drop every transform (no rise, no button press offset) and
  reduce transitions to a plain opacity fade or to nothing at all.

## Iconography and accessibility

- **No icon font, no SVG sprite, nothing from a CDN.** If an icon is needed it is an inline `<svg>` in
  the markup or a text glyph (`✓`, `⚠`, `▸`). This is the offline invariant again, not a style
  preference.
- **WCAG AA contrast on every token pair.** The pairs that must be checked in both modes:
  `--color-text-1` on `--color-bg`, `--color-text-1` on `--color-surface`, `--color-text-2` on
  `--color-surface`, `--color-text-3` on `--color-surface` (hints — the tightest one), button label on
  `--color-primary`, `--color-primary` on `--color-surface` (links), `--color-accent` on
  `--color-surface`, `--color-error` on `--color-surface`, and `--color-border` against
  `--color-surface` for the 3:1 non-text minimum.
- **Focus is always visible** via `--color-focus` (2px outline, 2px offset). Never a bare
  `outline: none` — if a focus ring is removed it is replaced in the same rule, never just deleted.
- **Every control has a real `<label>`** bound with `for`/`id`; hints and errors are linked through
  `aria-describedby`. Icon-only buttons carry an `aria-label`.
- **Results live in `aria-live="polite"` regions; errors use `role="alert"`.** Beyond accessibility,
  this is the semantic layer Playwright's accessible locators (`getByRole`, `getByLabel`) depend on —
  weakening it breaks the E2E suite, not just screen readers.
- **State is never colour-only.** Copied shows a checkmark and a label change; errors show a glyph and
  a sentence; success shows the word, not just the green.
</content>
