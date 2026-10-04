# ssss-webpage — Agent Guide

A single, self-contained, 100% offline HTML page that splits a text secret into N Shamir shares and
recombines them again. It ships as one artifact, `dist/index.html`, for people who need to store a
high-value secret (a seed phrase, a master password, a recovery key) split across several places.

## Start here

- **Run `/graphify` before each session.** The persistent graph at `graphify-out/graph.json`
  summarizes architecture, dependencies and cross-cutting concepts without re-reading the repo.
- **Before touching UI:** use the `impeccable` skill. If the project has no design context yet
  (`PRODUCT.md` / `DESIGN.md` at the root), **run `$impeccable teach` first** — it explores the code
  and **interviews you** about the project's direction (register, users, personality, visual
  direction) and writes `PRODUCT.md` + `DESIGN.md`; never hand-author it. Also read `design-system.md`
  (palette/type/components) and `user-stories.md` before defining a slice, then follow
  [UI/UX workflow — stack-aware](docs/agents/ui-workflow.md#uiux-workflow--stack-aware) for the visual loop.
- **Read `docs/FINDINGS.md` before debugging or touching the build** — non-obvious gotchas.
  **Convention:** when you discover something non-obvious that cost time and isn't deducible from the
  code, add a short entry to `docs/FINDINGS.md`.

## ⚡ graphify — use every session

```text
/graphify            # first run (builds graph from scratch)
/graphify --update   # incremental update (only re-extracts changed files)
/graphify query "<question>"    # architecture questions instead of opening multiple files
/graphify explain "<name>"      # locate a concept or symbol
/graphify path "A" "B"          # dependency path between two modules
```

Outputs in `graphify-out/`: `graph.json` (source of truth), `GRAPH_REPORT.md` (god nodes,
communities, surprising connections), `graph.html` (interactive view).

Run `/graphify --update` at end of session if you touched docs or images (code changes rebuild via
hook if installed).

## ⚡ superpowers — use whenever applicable

Always prefer **superpowers** skills over ad-hoc approaches. If there's even a small chance a skill
applies to the task, invoke it via the `Skill` tool before acting (including before clarifying
questions).

- **Process skills first** — `brainstorming` before creative/feature work, `systematic-debugging`
  before fixing bugs, `test-driven-development` before writing implementation.
- **Then implementation skills** — domain-specific skills guide execution.
- **Verify before claiming done** — `verification-before-completion` / `requesting-code-review`
  before merging.

Flow: `brainstorming → spec (you approve) → writing-plans → plan (you approve) →
subagent-driven-development → finishing-a-development-branch`. **Nothing is implemented without an
approved spec.**

User instructions always take precedence over skills; skills override default behavior. **Skills
refine *how* the work is done; they never override the rules in this file. When a skill and this
`AGENTS.md` conflict, this file wins.**

### Mode switch

- **"lite mode"** — fully disables superpowers: no skill is invoked, not even the applicability
  check, until **"normal mode"** is said.
- **"normal mode"** (default) — standard superpowers behavior, plus: when delegating coding work,
  dispatch at most 1 **implementation** agent at a time (a read-only review agent runs alongside it — see **Agent orchestration**), and never use a model above Sonnet (no Opus).
- **"modo desatendido"** (unattended mode) — the user is away and delegates autonomy: work without
  waiting for confirmations and make reasonable decisions yourself instead of asking. In this mode you
  MAY **`git push` the feature branches you create** and **open PRs via `gh`** on your own, so the
  work is ready for review when the user returns. The hard limits still hold and are NOT lifted:
  **never merge anything** (no `git merge`, no fast-forward integration, no `gh pr merge`), **never
  push to `main`** or any protected/default branch directly, and **never** `git push --force` /
  `--force-with-lease`. Deliver everything as pushed branches + PRs for the user to merge. Reverts to
  defaults on **"normal mode"**.
  **Pace in this mode** (2026-10-04): intermediate tasks run only the tests of what they touched
  (`pnpm exec vitest related <files>`) plus that task's E2E specs; commits pile up locally and the
  branch is pushed **once, at the end**, the push whose `pre-push` runs the full suite and the E2E.
  Each intermediate push paid the whole gate to report nothing the next one would not.

Confirm the switch briefly when it happens.

---

## Rules by topic — what always binds, and where the detail lives

This file fits in the 32 KiB Codex reads by default (`wc -c AGENTS.md` ≤ 32768; when it grows, move
detail to `docs/agents/`, never raise the limit). The detail of each topic was moved verbatim to
`docs/agents/` on 2026-10-04. **The lines below bind even if you never open the document; open it
before working on that topic.** A rule is edited in its document, not here and there at once —
except for its one-line summary in this list.

- **E2E (Playwright)** → [docs/agents/e2e.md](docs/agents/e2e.md), before writing or running a spec.
  One spec per main journey, against the built artifact, Chromium and the other configured browsers;
  the minimum assert is the outcome, not that a button exists; the spec fails on console errors;
  accessible locators only; blocking in `pre-push`; a UI bug fix gets a failing E2E first.
- **UI** → [docs/agents/ui-workflow.md](docs/agents/ui-workflow.md), before touching a screen or
  component. `impeccable` first; `PRODUCT.md` / `DESIGN.md` never by hand; every new value is a
  design token; nothing is done until the real render was observed after the last change (themes,
  sizes, states) and the E2E gate is green.
- **Quality beyond coverage** →
  [docs/agents/quality-beyond-coverage.md](docs/agents/quality-beyond-coverage.md). Mutation testing
  first (60% floor over the core logic, a ratchet that only goes up), property-based tests, runtime
  validation at the boundary, strict types + SAST, dependency audit. `SURVIVED` and `NO_COVERAGE`
  mean opposite things; expected values are written by hand.
- **Real-environment verification** →
  [docs/agents/real-environment-verification.md](docs/agents/real-environment-verification.md). What
  no in-process test can prove (restarts, the real server, disk, the scheduler) gets a script
  against the real artifact; every new check is seen failing once; never assert on a count you
  cannot predict; a test that touches shared state restores it.
- **CI & git hooks** → [docs/agents/ci-and-hooks.md](docs/agents/ci-and-hooks.md).
  `.githooks/pre-push` runs the full suite, E2E included, inside the cgroup; CI stays lean; never
  bypass a hook to make a push go through.
- **Agentic PR verification (mandatory)** →
  [docs/agents/pr-verification.md](docs/agents/pr-verification.md). Every PR gets the verdict of a
  pass that drives the running app, as a PR comment; it never merges.
- **Debugging** → [docs/agents/debugging.md](docs/agents/debugging.md), before chasing a bug.
  Measure before ablating; more than three reproductions → a shortcut script before the fourth; a
  review finding is not a reproduction; every assertion is seen failing once; environment claims get
  measured or they don't get made.
- **Agent orchestration** →
  [docs/agents/agent-orchestration.md](docs/agents/agent-orchestration.md). Review in parallel with
  the next implementation; shared `docs/FACTS.md`; plans carry contracts, not uncompiled code;
  discretionary decisions batched and priced; review is never cut.
- **Design principles (SOLID)** →
  [docs/agents/design-principles.md](docs/agents/design-principles.md). No abstraction without a
  second implementation, an IO boundary or a test seam; speculative abstraction is a review finding.
- **Codex and Claude Code** →
  [docs/agents/agent-compatibility.md](docs/agents/agent-compatibility.md). Rules are edited in
  `AGENTS.md` (or its `docs/agents/` document), never in `CLAUDE.md`.

## 🧠 Heavy jobs run inside a memory cgroup (MANDATORY)

**No exceptions:** any long or parallel job started here — the full test suite, coverage, mutation
testing, a production build, Playwright, a `turbo`/workspace fan-out, anything that spawns workers —
runs under a kernel-enforced memory ceiling:

```bash
systemd-run --user --scope --quiet -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>
```

**6 GB is the standing ceiling on this machine** (raised from 4 GB by the user on 2026-08-11); don't
exceed it without being told to. `MemoryHigh` throttles and reclaims, `MemoryMax` is the hard stop,
`MemorySwapMax=0` keeps the job from thrashing swap instead of respecting either. Verify it is
actually in force rather than assuming:
`systemctl --user show <scope> -p MemoryMax -p MemoryHigh -p MemoryCurrent`.

**Cap the tool too — but never *instead* of the cgroup.** Pass the tool's own concurrency limit
(`--concurrency`, `--maxWorkers`, `workers`, `--parallel`) so the job isn't throttled to a crawl by
the ceiling. A tool's default concurrency is not a budget, and an estimate of per-worker RSS is not a
ceiling. Only the cgroup is.

**Why this is a rule and not advice:** a mutation-testing run on this 24-core box sized its worker
pool from the core count and spawned **23 workers at ~2.3 GB each** — ~50 GB of demand on 31 GB of
RAM. It took the whole machine down hard enough that the user had to power-cycle it; `systemd-oomd`
did not save it. The run before that was wasted too: with the machine starving, **139 of the first
142 mutants "timed out"**, and a timeout is scored as *killed*, so the result came out inflated by
starvation and meant nothing. A job that OOMs the box doesn't merely fail — it also hands you
numbers you'd trust by mistake.

---

## Stack

| Layer            | Choice                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| Language         | TypeScript 5 (`strict` + `noUncheckedIndexedAccess`), no framework, vanilla DOM      |
| Crypto           | `shamir-secret-sharing` **pinned exactly to 0.0.4** — GF(2^8) Shamir, zero deps, audited, Apache-2.0 |
| Build            | esbuild 0.28 via `build.mjs` (JS API) → single-file `dist/index.html`, classic IIFE script |
| Unit tests       | Vitest 4 (`node` environment) + `@vitest/coverage-v8`                               |
| Property tests   | fast-check 4                                                                        |
| Mutation tests   | Stryker 10 + `@stryker-mutator/vitest-runner`, scoped to `src/core`                 |
| E2E              | Playwright 1.62, chromium + firefox, driving the built `dist/index.html` over `file://` |
| Package manager  | **pnpm 11** (`pnpm-lock.yaml`)                                                      |

> **No framework, no runtime network, one artifact.** There is no React, no bundler dev server and no
> backend: the shipped product is `dist/index.html` with JS and CSS inlined, and it must never issue a
> network request. The crypto library is **pinned exactly to 0.0.4** on purpose — that is the version
> covered by the Cure53 (Feb 2023) and Zellic (Aug 2023) audits. **Don't bump it without re-reading
> the audits**; the audited version *is* the point. It is Apache-2.0, Copyright 2023 Horkos, Inc.,
> and its notice ships in the page's Licenses section.
>
> **TypeScript stays on 5.x.** The 7.x native port no longer exposes the compiler API that Stryker's
> sandbox calls, so upgrading silently costs you the mutation gate — see `docs/FINDINGS.md`.

---

## Project structure

```text
ssss-webpage/
├── AGENTS.md  CLAUDE.md  design-system.md  user-stories.md  README.md
├── docs/FINDINGS.md
├── package.json  pnpm-lock.yaml  tsconfig.json  .gitignore
├── build.mjs                      # esbuild → dist/index.html + offline assertions
├── vitest.config.ts  stryker.config.json  playwright.config.ts
├── .github/workflows/release.yml  # tag v* → build + attach dist/index.html to the Release
├── src/
│   ├── core/                      # pure, DOM-free logic (+ colocated *.test.ts)
│   │   ├── crc32.ts               # crc32(bytes): number — IEEE reflected
│   │   ├── base64.ts              # bytesToBase64 / base64ToBytes (chunked)
│   │   ├── errors.ts              # error classes + explainError(e): string
│   │   ├── payload.ts             # encodePayload / decodePayload (version + CRC32 header)
│   │   ├── shareCodec.ts          # shareToString / stringToShare / parseShareInput
│   │   ├── validate.ts            # validateSplitParams / secretSizeWarning
│   │   └── sss.ts                 # splitSecret / combineShares (only file importing the library)
│   ├── ui/main.ts                 # initApp(document): DOM wiring
│   ├── app.ts  index.html  styles.css
├── e2e/  fixtures.ts  flow.spec.ts  errors.spec.ts  security.spec.ts  copy.spec.ts
└── dist/index.html                # committed build artifact
```

> `dist/index.html` is a **committed build artifact**, not generated-and-ignored output: it is what a
> user downloads from a Release, so it lives in git and must be rebuilt in the same commit as any
> `src/` change.

---

## Tests and quality

- **Unit:** Vitest 4 in the **`node` environment** (no jsdom — `src/core` never touches the DOM) —
  `*.test.ts` colocated with the source inside `src/core`.
- **Property tests:** fast-check 4, living in the *same* suites as the unit tests they generalize
  (round-trips, arbitrary byte inputs, share subsets and orderings).
- **Mutation tests:** Stryker 10 + `@stryker-mutator/vitest-runner`, `mutate` scoped to `src/core`.
- **Browser E2E: Playwright — mandatory**, not "when there are navigation flows". Chromium **and**
  firefox, driving the built `dist/index.html` over `file://`. See
  [E2E (Playwright) — mandatory](docs/agents/e2e.md#e2e-playwright--mandatory) below.
- **Coverage gate: 80%** global and **`src/core` ≥ 90%** (statements/branches/functions/lines).
  Don't lower the gate — exclude with a written justification: `src/ui/**` and `src/app.ts` (thin DOM
  wiring, proven end-to-end by Playwright against the real artifact), the config files
  (`vitest.config.ts`, `playwright.config.ts`, `stryker.config.json`) and `build.mjs` (self-asserting,
  and its output is what E2E consumes). Before PR: `pnpm pr-check`
  (= `pnpm type-check` + `pnpm test:cov`).
- **Mutation gate: `thresholds.break = 85`** over `src/core` (`pnpm test:mutation`), **blocking in
  `pre-push`** and advisory in CI. The floor the template sets is **60%**; this repo sits at 85
  because `src/core` is pure, DOM-free and property-tested, which is the easiest place in any
  codebase to kill mutants. It is a **ratchet**: it rises with the real score and never drops to 60
  to let a push through. When the run gets heavy the lever is the **scope**, never the threshold.

### The pyramid per feature — one E2E per journey, the rest one layer down

**Rule since 2026-10-04** (claude-md template, from a Compose app whose E2E ate days of agent time:
829 runs and 11 h in one day). A new feature gets **one Playwright spec per main journey** — the
happy path end to end against the real API: get in, do the thing, see it survive a reload — and at
most one more for a journey that only shows up in a real browser. Everything else — form validation,
empty states, error messages, disabled buttons, values the UI computes — goes one layer down:
**Vitest unit and fast-check property tests in `src/core`** (pure, DOM-free; `src/ui` stays E2E-only by design, so a UI edge case that is really logic moves into `src/core` and is tested there), which cost seconds and run in the merge gate.

- **When one more E2E is right:** what no in-process test can answer — real navigation, cookies and
  auth redirects, file upload, a layout that hides a control, sync against the real server, a
  process restart. The spec's header says why it is not a component test.
- **A UI bug still gets its failing test first** — in E2E only when it is on that list; if it
  reproduces one layer down, the red test goes there.
- **Existing specs are not migrated for this rule.** It applies to new work and to what a change touches.

### Running E2E — the whole suite once at the end, only the reds in between

- **While working:** only the specs the task creates or touches, plus those over the screens it
  changes — `pnpm test:e2e <spec>` with a file or `--grep @<feature>`.
- **The full suite runs once, at the end of the branch, and alone** (no other build, E2E run or seed
  against the same stack at the same time), in the background while you write the PR. Push and PR
  only after it is green.
- **Red pass → only the reds** (`pnpm test:e2e --last-failed`) until they are green or proven red on the
  base commit too; then **one** full confirmation pass — the one that catches a fix breaking another spec.
- **Three reds in a row on one spec → stop.** Read the evidence before a fourth change: the trace
  (`--trace on`, then `playwright show-trace`), the screenshot and the console.
- **New and touched specs:** a feature tag (`test('…', { tag: '@<feature>' }, …)`); straight to the
  screen with `page.goto` and a saved session (`storageState`) instead of logging in through the UI;
  data seeded through the API; no `waitForTimeout` — assert on state; animations off
  (`use: { contextOptions: { reducedMotion: 'reduce' } }`).
- **Every heavy command** runs under `timeout --kill-after=60s <limit>`, inside the cgroup.

### Run before declaring done

| Change touches                                | Run before claiming success                                    |
| --------------------------------------------- | -------------------------------------------------------------- |
| `src/core` (crypto, codec, payload, validate) | `pnpm test` — plus `pnpm test:mutation` when the logic changed  |
| `src/ui`, `src/index.html`, `src/styles.css`, `build.mjs` | `pnpm test:e2e` — **required**, unit tests do not prove the flow works |
| something ambiguous or large                  | `pnpm test:all`                                                 |

### What to test per folder

| Folder                | What                                                                                   | Status |
| --------------------- | -------------------------------------------------------------------------------------- | ------ |
| `src/core/`           | Exhaustive unit + fast-check property tests + Stryker mutation testing. Pure, DOM-free, no mocks | Done   |
| `src/ui/`, `src/app.ts` | E2E only (Playwright against the built artifact); excluded from unit coverage with justification | Done   |
| `build.mjs`           | Self-asserting post-build checks (single file, no external refs, no `node:crypto`, no URLs); E2E consumes its output | Done   |

### TDD — required for new logic

For new code in `src/core/` (crypto wrappers, codecs, payload framing, validation) and for any
behavior change in `src/ui/`:

1. **Red** — write a failing test that describes the behavior.
2. **Green** — implement the minimum to pass.
3. **Refactor** — clean up under green tests.

Exceptions (TDD not required): pure visual/style changes (CSS, layout, copy); spikes/exploration —
but add tests before merging.

### Hard rules (no exceptions)

- **Never claim done without showing test output.** "Type-check passes" is not "it works".
- **New core function / codec / validation rule → needs a test.** No exceptions.
- **A bug fix needs a failing regression test first**, then the fix (see `systematic-debugging`).
- **Never delete, `.skip` or `.only` a test to get green.** Fix the code or the test on purpose.
- **No feature with UI is done without a green E2E against the real artifact.** Driving the built
  page (Playwright over `file://`) is the proof — type-check, unit tests and a screenshot are not.
  If the flow has no spec, the flow is not finished.
- **Never mock the crypto library to make an E2E pass.** A mocked E2E proves the mock works, not the
  product.
- **Don't lower the 80% gate to ship** — exclude untestable modules in config with a written reason.
- **Test over mock** — exercise real code with minimal stubs; don't mock entire modules.

### Operative conventions

- **Global setup file** — define any shared stub (clipboard, timers) once. Don't redefine per test.
- **Split by aspect** when a test file exceeds ~300 LoC: `.flow.test.ts`, `.errors.test.ts`,
  `.branches.test.ts`.
- **Exclude with justification** in config, never silently. Example:

  ```js
  // Thin DOM wiring — no branching logic; proven by Playwright against the real dist/index.html
  exclude: ['src/ui/**', 'src/app.ts']
  ```

## Dev workflow (scripts in `package.json` — cross-platform, no `make`)

```bash
pnpm install --frozen-lockfile          # Node >= 20; installs from pnpm-lock.yaml
pnpm exec playwright install chromium firefox   # one-time browser download
pnpm build            # esbuild → dist/index.html (JS+CSS inlined) + offline assertions
pnpm type-check       # tsc --noEmit
pnpm test             # Vitest unit + property   | test:watch | test:cov (gate)
pnpm test:e2e         # rebuilds dist/ first, then Playwright on chromium + firefox
pnpm test:mutation    # Stryker over src/core
pnpm test:all         # everything
pnpm pr-check         # type-check + test:cov
```

First boot: `pnpm install --frozen-lockfile` → `pnpm exec playwright install chromium firefox` →
`pnpm build`. The Playwright browser download is the **only** network access this project ever needs,
and it happens at build time on your machine — the runtime artifact stays zero-network.

**There is no dev server on purpose** — after `pnpm build`, open `dist/index.html` by double-clicking
it, exactly like a user would. A dev server would serve the page over `http://`, which is a secure
context and would hide the `file://` constraints this product actually ships under (see
`docs/FINDINGS.md`).

## Working rules

- **Heavy or parallel jobs run inside a memory cgroup** — never launch a suite, build or
  fan-out on a bare estimate; wrap it in
  `systemd-run --user --scope -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>`
  and cap the tool's own concurrency too.
- **Use superpowers skills whenever they apply** — invoke via `Skill` before acting; process skills
  before implementation skills.
- **New dependencies: ask first, then install** — adding a package is allowed when the task
  genuinely needs one, but ask before installing (which package, why, what it replaces) and wait
  for the go-ahead. The stack is intentional, so check what is already in `package.json` first.
  Exception: obvious test devDeps.
- **TDD by default** for new logic. Don't merge logic without tests.
- **Every user-facing journey ships with a Playwright E2E** that drives the real built artifact over
  `file://` — one spec per journey, edge cases in `src/core`. Unit tests green ≠ it works — the
  recurring failure mode is a feature that renders fine and then breaks on the first real click.
  Blocking before push.
- **Don't lower the coverage gate** — exclude with justification instead.
- **No `any`** — `unknown` + type guards or domain types.
- **Reuse before you write** — `src/core/` already owns the pure pieces (`crc32`, `base64`, `payload`,
  `shareCodec`, `validate`, `errors`, `sss`), `src/ui/main.ts` wires them to the DOM, and the specs
  share `e2e/fixtures.ts`. Search before adding one (`rg -n "^export " src/`). A second encoder, CRC
  or error-explainer is not a duplicate this repo can afford: the artifact splits secrets, and two
  implementations of one format means a share that comes back uncombinable. Only `sss.ts` imports the
  library — keep it that way. Extend the existing module; at the third copy extract into `src/core/`
  in the same commit, migrating call sites and rebuilding `dist/index.html`.
- **Zero-network invariant.** The artifact must never issue a network request of any kind. There are
  four enforcement points: the CSP `<meta>` in `src/index.html`, the URL scan in `build.mjs`, the
  forbidden-token scan in `build.mjs`, and the Playwright request guard. **Never weaken any of them
  to make something pass** — if a change trips one, the change is wrong, not the guard.
- **Nothing in the page may navigate, and nothing may use WebRTC.** `build.mjs` rejects
  `location.href`, `location.assign`, `location.replace`, `document.location`, `window.open`,
  `<meta http-equiv="refresh">` and `RTCPeerConnection`. These are not belt-and-braces: they are the
  **only** thing stopping the two channels a CSP cannot close. A top-level navigation has no
  governing directive (`navigate-to` is gone from the spec, `sandbox` is ignored in a `<meta>`
  policy), and WebRTC is governed by no directive at all — a TURN allocate leaves the machine with
  zero CSP violations and is invisible to Playwright's request events too. See `docs/FINDINGS.md`.
- **The CSP pins the artifact by hash.** `build.mjs` computes the SHA-256 of the exact inlined script
  and stylesheet and writes them into the policy, so the browser refuses any other inline code,
  injected handler attribute included. Never relax a hash back to `'unsafe-inline'` to make something
  work; rebuild instead.
- **Know what the build scan is and is not.** The forbidden-token list and the URL scan are
  regression guards against *accidents* — `window['fetc'+'h']` defeats the token list and a URL built
  from `String.fromCharCode` defeats the scan, and the scan only understands `http(s)`, so `stun:`,
  `turn:` and `ws:` are invisible to it. Against a hostile change, what holds is review plus the
  hashed CSP. Don't cite the scan as proof that something unreviewed is safe.
- **Never use `crypto.subtle`.** Not because it is missing — `file://` *is* a secure context and it
  works there; that belief was wrong and `docs/FINDINGS.md` explains it. Because there is no key, so
  no unkeyed digest authenticates anything a CRC32 does not, and because depending on secure-context
  status would put the page's core function at the mercy of browser policy. Randomness comes from
  `crypto.getRandomValues` inside the library; integrity comes from our own CRC32. No exceptions.
- **Never claim the page authenticates a share.** It cannot: whoever supplies a share can choose what
  the user recovers. Say so wherever confidentiality is claimed, at the same level of prominence —
  the page states it next to the recovered secret, not only in a collapsed section.
- **One artifact, one file.** `dist/index.html` is the product: JS and CSS inlined, a classic IIFE
  `<script>` (Chrome blocks ES module scripts over `file://`), and no external reference of any kind —
  no fonts, no images, no source maps, no CDN.
- **Secrets never leave the page.** No `localStorage` / `sessionStorage` / IndexedDB / cookies, no
  network, and **never log secret or share material to the console** — not even while debugging.
- **`src/core` stays pure and DOM-free.** It is the scope of the mutation and property tests; DOM
  access belongs in `src/ui` and `src/app.ts` only.
- **Never modify the vendored library.** Wrap it, don't patch it, and keep the Apache-2.0 attribution
  and license text in the page's Licenses section.
- **Rebuild and commit `dist/index.html` in the same commit as any `src/` change** — a stale artifact
  silently ships old code, and the artifact is what users actually run.
- **Keep this file's Stack/Architecture section current** — when you ship something previously marked
  "planned", update the Stack tables and module list in the same change. A stale `AGENTS.md` misleads
  the next session.
- **UI work → design context first, then `impeccable` + superpowers** — for any UI/frontend change,
  invoke the `impeccable` skill (and its sub-skills: `shape`, `polish`, `critique`, etc.). First, if
  the project has no design context yet (`PRODUCT.md` / `DESIGN.md` at the root), run the impeccable
  `teach` flow (`$impeccable teach`) — it explores the codebase and then interviews you about the
  project's direction and writes `PRODUCT.md` (strategic) + `DESIGN.md` (visual) (auto-migrating a
  legacy `.impeccable.md` to `PRODUCT.md`). **Never hand-author the design context — `teach` gets it
  from you, not from the AI guessing.** Then follow
  [UI/UX workflow — stack-aware](docs/agents/ui-workflow.md#uiux-workflow--stack-aware) — for this product restraint is the
  ceiling, not expression. Don't hand-roll UI without impeccable + superpowers.
- **SOLID applied with judgement, not by rote** — see
  [Design principles — SOLID](docs/agents/design-principles.md#design-principles--solid-applied-with-judgement): `src/core` pure /
  `src/ui` DOM-only / `build.mjs` the sole IO boundary is the seam this repo already keeps; a
  speculative interface with one implementation is a review finding, not a virtue.
- **Commits in English**, Conventional Commits. Scope = module/folder.
- **Instrument before you ablate, budget the lap, and dispatch review in parallel** — a pipeline that completes with non-empty output produced output; more than three reproductions means you owe a shortcut script; a review finding is not a reproduction; and the review of task N runs alongside the implementation of N+1. See **Debugging** and **Agent orchestration** above.

## Git & GitHub

- **Commits and branches OK** — create commits and new branches whenever it makes sense, without asking first.
- **Never push** *(default)* — no `git push` under any circumstance, and absolutely never
  `git push --force` / `--force-with-lease`. Leave pushing to the user. **Exception:** when
  **"modo desatendido"** is active, you may push the feature branches you create (never `main`/protected
  branches, never force) so PRs are ready for review.
- **Never merge — no permission** — you do NOT have permission to merge anything into any branch, nor to
  merge any pull request. No `git merge`, no fast-forward integration, no `gh pr merge`. This holds in
  every mode, **including "modo desatendido"**. Leave every merge (branches and PRs alike) to the user.
- **GitHub via `gh`** — if the `gh` CLI is available, you may open pull requests, issues, and similar
  (comments, labels, etc.). These don't require pushing on your part beyond what `gh` itself does for an
  already-pushed branch.
- **Branches:** `feat/name`, `fix/description`, `chore/task`.
- **Every PR must include a manual test plan** — when opening a PR, add a **How to test manually**
  section describing the exact steps to exercise the change by hand. For a web page/UI, list the concrete
  routes/URLs to visit (e.g. `/dashboard/settings`), what to click or input, and the expected result.
  Include any setup (seed data, env vars, feature flags, login/role) and, where relevant, edge cases and
  error states to check. Here that means: run `pnpm build`, open `dist/index.html` by double-clicking it
  (with networking off), and list the exact secret/shares to type and the expected result.

