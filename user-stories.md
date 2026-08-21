# ssss-webpage — User Stories

## Roles

| Symbol | Role      | Description                                                                    |
| ------ | --------- | ------------------------------------------------------------------------------ |
| 👤     | `visitor` | Anyone who opens the page. There are no accounts, no server and no persistence — everything happens in their browser |

There is exactly one role on purpose: the product has no backend, so there is nothing to sign in to
and no permission to check. Every criterion below applies to every user.

---

## Epic 1 — Split a secret

### US-01 Split a secret with the defaults

**As a** visitor **I want** to paste a secret and get shares without configuring anything **so that**
I can split a seed phrase in one step without understanding Shamir's parameters first.

**Acceptance criteria:**

- With the defaults untouched (**3 shares, threshold 2**), submitting a non-empty secret renders
  exactly 3 shares, each numbered 1–3 and rendered in monospace.
- Every generated share matches `^sss1-[A-Za-z0-9+/]+=*$` — the `sss1-` prefix is always present and
  the payload is standard base64.
- An empty or whitespace-only secret is rejected with a clear message ("Enter a secret to split.")
  and **no shares are generated**; the results region stays empty.
- Splitting again replaces the previous result entirely — no stale shares from an earlier secret ever
  remain visible on screen.

### US-02 Choose the number of shares and the threshold

**As a** visitor **I want** to pick how many shares are produced and how many are needed to recover
**so that** the split matches how I actually plan to store them (e.g. 5 shares, any 3 recover).

**Acceptance criteria:**

- Both fields accept integers only; the accepted range is **2 ≤ threshold ≤ shares ≤ 255**.
- Any violation is blocked **before anything is generated**, with a message that names the offending
  field (e.g. "Threshold cannot be greater than the number of shares." next to the threshold input).
- A valid configuration produces exactly the requested number of shares, and any subset of size
  `threshold` recovers the original secret.
- Non-integer, negative, zero and out-of-range inputs (`1.5`, `0`, `-3`, `256`) are all rejected with
  a field-specific message rather than silently clamped.

### US-03 Copy a share

**As a** visitor **I want** to copy each share individually with visible confirmation **so that** I
can paste it into a password manager or a note without hand-transcribing it or grabbing the wrong one.

**Acceptance criteria:**

- Each share has its own copy button; pressing it gives visible confirmation (label swaps to
  "Copied" with a checkmark) that reverts after about 1.5 seconds.
- The value placed on the clipboard is **byte-identical to the string displayed** for that share,
  including the `sss1-` prefix and with no leading or trailing whitespace.
- If the clipboard write fails (permission denied, unsupported context), the share's text is
  programmatically selected and the button tells the user to press Ctrl+C — the flow never dead-ends
  with a silent failure.
- A secret larger than 4 KB shows a **non-blocking** hint that shares will be long and awkward to
  copy or transcribe; the split still proceeds normally if the user continues.

---

## Epic 2 — Combine shares

### US-04 Recover the secret from enough shares

**As a** visitor **I want** to paste any `threshold` shares and get my secret back **so that** I can
recover it later without remembering which shares I used or what order they were in.

**Acceptance criteria:**

- Shares are entered one per line; **any** subset of at least `threshold` shares recovers the secret,
  in **any order**, and providing more than `threshold` shares works just as well.
- The recovered text is **byte-identical** to the original, including emoji, CJK characters and
  embedded newlines.
- Blank lines and surrounding whitespace on each line are tolerated and do not count as shares.
- The recovered secret is rendered in monospace inside an `aria-live="polite"` region and can be
  copied with the same confirmation behaviour as US-03.

### US-05 Get a clear failure instead of a wrong secret

**As a** visitor **I want** an unmistakable failure when recovery cannot succeed **so that** I never
walk away believing a garbled string is my secret.

**Acceptance criteria:**

- Supplying fewer than `threshold` valid shares produces "Could not recover a valid secret…" in an
  alert, and **no secret is rendered** — not even a partial or garbled one.
- A share whose payload has been altered (a flipped character) produces the same failure; the
  built-in checksum is what detects it.
- The failure message appears in a `role="alert"` element and the result region is cleared, so a
  previous successful recovery can never be mistaken for the current one.
- Under no combination of inputs does the page display a secret it could not verify — a failed
  checksum always wins over rendering something.

### US-06 Understand exactly what is wrong with my input

**As a** visitor **I want** format problems reported precisely **so that** I can fix the one bad line
instead of re-pasting everything and guessing.

**Acceptance criteria:**

- A line that is not a well-formed share is reported with its **1-based line number** (e.g. "Line 3
  is not a valid share.").
- A share pasted twice is named as a duplicate ("Line 4 repeats the share on line 2.") rather than
  being silently deduplicated or counted twice toward the threshold.
- Shares that come from **different splits** are rejected with a message saying so, instead of being
  combined into garbage.
- Format errors are reported **before** any combine is attempted, and the error text names the
  problem type — never a bare "invalid input" or a raw exception message.

---

## Epic 3 — Trust and offline

### US-07 Use the page with no network at all

**As a** visitor **I want** the page to work fully offline from a local file **so that** my secret is
never exposed to a network I have to trust.

**Acceptance criteria:**

- Opening `index.html` by double-clicking it (a `file://` URL), with networking disabled, the full
  split → copy → combine flow succeeds end to end.
- The page issues **zero network requests** of any kind — no `fetch`, no `XMLHttpRequest`, no image,
  font, script or stylesheet fetched from anywhere. A Playwright request guard fails the suite if a
  single one is observed.
- The artifact is one self-contained file: JS and CSS are inlined and it contains no external
  reference. The build fails if any external URL reaches the bundle.
- A restrictive CSP `<meta>` in the page blocks outbound connections even if an external reference
  were somehow introduced.

### US-08 Leave nothing behind

**As a** visitor **I want** the page to forget everything as soon as I close it **so that** the next
person on this computer finds no trace of my secret.

**Acceptance criteria:**

- After a reload, **every field is empty** — secret, shares, threshold results and recovery output —
  with no restored state of any kind.
- No browser storage is written: `localStorage`, `sessionStorage`, IndexedDB and cookies are all
  untouched after a full split-and-combine session (asserted in E2E).
- Secret and share material is never written to the console, and no file is downloaded or saved.
- Nothing is placed on the clipboard except what the user explicitly copies via a copy button.

### US-09 Understand what this page does and does not protect

**As a** visitor **I want** the page to explain its own guarantees **so that** I store the shares
properly and do not overestimate what the checksum protects me from.

**Acceptance criteria:**

- A collapsed **Security notes** disclosure explains: use the page offline; keep the shares in
  **separate** places; fewer than `threshold` shares reveal **nothing** about the secret; and the
  built-in checksum detects **accidents** — wrong, insufficient or corrupted shares.
- The same disclosure states plainly that the checksum is **not tamper-proofing**: anyone who can
  alter a share can recompute the checksum too.
- A collapsed **Licenses** disclosure carries the Apache-2.0 notice for the bundled
  `shamir-secret-sharing` library (Copyright 2023 Horkos, Inc.) along with the audit references.
- Both disclosures are closed by default, keyboard-reachable and expandable without leaving the page,
  so they inform without competing with the main task.

---

## Out of scope (explicitly, for v1 and beyond unless revisited)

- **File or binary secrets** — text only. No file picker, no drag-and-drop.
- **QR codes** — neither generated nor scanned.
- **File downloads** — shares are copied, never saved to disk by the page.
- **Share metadata or labels** — no names, dates, comments or hints attached to a share.
- **i18n** — the UI is English only.
- **Any kind of persistence or sync** — no storage, no accounts, no export/import of sessions. This is
  a guarantee, not a missing feature.

---

## Summary by epic (MVP priority)

| Epic                     | Stories        | Priority    |
| ------------------------ | -------------- | ----------- |
| 1 · Split a secret       | US-01 to US-03 | 🔴 Critical |
| 2 · Combine shares       | US-04 to US-06 | 🔴 Critical |
| 3 · Trust and offline    | US-07 to US-09 | 🔴 Critical |

> All three epics are critical. Epic 3 is **not** a nice-to-have polish pass: "works with no network
> and leaves nothing behind" is the product's core promise — a splitter that phones home or caches a
> secret is worse than no splitter at all. Build order is 1 → 2 → 3, but nothing ships until 3 is green.
