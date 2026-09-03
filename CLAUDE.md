# ssss-webpage — Claude Guide

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
  (palette/type/components) and `user-stories.md` before defining a slice.
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
`CLAUDE.md` conflict, this file wins.**

### Mode switch

- **"lite mode"** — fully disables superpowers: no skill is invoked, not even the applicability
  check, until **"normal mode"** is said.
- **"normal mode"** (default) — standard superpowers behavior, plus: when delegating coding work,
  dispatch at most 1 agent at a time, and never use a model above Sonnet (no Opus).
- **"modo desatendido"** (unattended mode) — the user is away and delegates autonomy: work without
  waiting for confirmations and make reasonable decisions yourself instead of asking. In this mode you
  MAY **`git push` the feature branches you create** and **open PRs via `gh`** on your own, so the
  work is ready for review when the user returns. The hard limits still hold and are NOT lifted:
  **never merge anything** (no `git merge`, no fast-forward integration, no `gh pr merge`), **never
  push to `main`** or any protected/default branch directly, and **never** `git push --force` /
  `--force-with-lease`. Deliver everything as pushed branches + PRs for the user to merge. Reverts to
  defaults on **"normal mode"**.

Confirm the switch briefly when it happens.

---

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
├── CLAUDE.md  design-system.md  user-stories.md  README.md
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
  [E2E (Playwright) — mandatory](#e2e-playwright--mandatory) below.
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

### E2E (Playwright) — mandatory

**Why this is a hard rule.** Unit tests pass while the product is broken: the component renders, the
type-check is green, and then a real click hits an endpoint that doesn't exist, sends the wrong
payload shape, or returns 500. Mocked fetches hide exactly that class of bug, because the mock
encodes what the author *assumed* the API does. Only driving the running app against the real API
proves the feature works.

- **Every user flow needs a spec** — create / edit / delete, navigation, forms, filters, auth-gated
  screens. A slice with UI is not done until its flow has a Playwright spec.
- **Against the running app and the REAL API.** Boot the stack from Playwright's `webServer` (or a
  compose target) and hit real endpoints against a **disposable test database** — never the dev DB.
  **Do not stub the network layer in E2E**; that's what the unit/integration layer is for.
- **The minimum assert is not "the button exists".** A flow is verified when: the request actually
  goes out, it answers 2xx, the UI reflects the change, and **the change survives a reload**
  (i.e. it was persisted, not just optimistic local state).
- **Fail loudly on noise.** Wire `page.on('console')` and `page.on('response')` so the spec fails on
  console errors and on unexpected 4xx/5xx — those are the API mismatches this layer exists to catch.
- **Accessible locators only** — `getByRole`, `getByLabel`, `getByText`; never brittle CSS/XPath.
  This doubles as the semantics layer the agentic PR verification depends on (see
  [Agentic PR verification](#agentic-pr-verification-mandatory-on-every-pr)).
- **Blocking on push.** `pnpm test:e2e` runs in the pre-push hook; a red E2E means no push.
- **A UI bug fix gets a failing E2E first**, then the fix — same rule as unit regressions.
- **Non-web surfaces generalize.** Native mobile (Jetpack Compose / SwiftUI) → **Maestro**: YAML
  flows in `.maestro/` driven against the real build on an emulator, with `maestro hierarchy` and
  `maestro mcp` for discovery (`maestro studio` no longer exists in Maestro 2.x). Desktop shell →
  Playwright's `_electron`; API-only services → a `pytest` + `httpx` (or supertest) smoke that
  exercises the real HTTP surface. The rule is "drive the real thing", not "use Playwright".
  **Note for this product specifically:** the artifact is one `dist/index.html` opened over
  `file://`, so there is no native surface today — and wrapping it in one would change the threat
  model, not just the test engine, since the offline guarantee would then depend on the wrapper.

**In this project.** There is no server and no API, so "drive the real thing" means the **real built
artifact opened over `file://`** — no Playwright `webServer`, no `localhost`. `pnpm test:e2e`
rebuilds `dist/` before running, so the specs always exercise the artifact a user would download.
**Never point E2E at `src/`** (that would test code that is never shipped) and **never mock the
crypto library** — the whole point is that the real GF(2^8) implementation round-trips in a real
browser. The **"the change survives a reload" rule inverts here**: this page must persist *nothing*,
so the E2E asserts the opposite — after a reload every field is empty, and no browser storage was
written. The "blocking on push" rule still holds, but there are no git hooks (see
[CI & git hooks](#ci--git-hooks)): the gate is `pnpm test:all` run locally before you push.

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

## Quality beyond coverage

**Coverage measures how much code runs, not whether it's correct.** This is especially treacherous
with AI: it tends to write the test *and* the code in one move, so if it misread the requirement, both
encode the same mistake and the test passes happily. 80% coverage with weak asserts is a false sense
of security. These gates attack that blind spot.

- **Mutation testing** *(highest priority, and here it is a gate, not advice)* — **Stryker** injects
  deliberate bugs (`>` → `>=`, drop a line, flip a boolean) and checks that some test fails. A
  surviving mutant means the code is *covered but not verified*. `mutate` is scoped to `src/core`
  (pure, DOM-free — mocked or DOM-bound code cannot kill mutants honestly), the runner is
  `@stryker-mutator/vitest-runner`, and `thresholds: { high: 90, low: 80, break: 85 }` — **`break` is
  the gate**, blocking on push, and the template's floor for it is 60. This is the direct antidote to
  AI's misleading coverage.
- **Property-based testing** *(highest priority)* — **fast-check** (JS/TS), **Hypothesis** (Python).
  Define invariants ("deserialize(serialize(x)) == x", "final price is never negative") and let the
  framework generate hundreds of cases, including the weird boundaries nobody thinks of. Catches logic
  errors that hand-picked examples miss.
- **Runtime boundary validation** — **Zod** (TS), **Pydantic** (Python) to validate everything
  crossing a boundary: API responses, forms, DB data. AI trusts types that don't hold at runtime; this
  turns those assumptions into explicit errors instead of silent failures.
- **Strict types + static analysis** — TypeScript in real `strict` mode (**including
  `noUncheckedIndexedAccess`**), type-aware ESLint, and a SAST (**Semgrep** or **CodeQL**). SAST
  matters because AI introduces vulnerabilities easily (injection, hardcoded secrets) that no
  functional test catches.
- **E2E / smoke tests** *(mandatory, not a nice-to-have)* — **Playwright** (web), **Maestro**
  (native Android/iOS — YAML flows plus `maestro hierarchy` / `maestro mcp` for discovery). Verify what unit tests can't: that the app *actually boots* and the full flow
  works. Code routinely passes every unit test while the app won't start or the frontend assumes an
  API contract the backend doesn't honor. This is the single highest-yield gate against
  "implemented but broken on first click" — see the hard rules in
  [E2E (Playwright) — mandatory](#e2e-playwright--mandatory).
- **Dependency auditing** — AI invents non-existent packages ("slopsquatting") and pulls vulnerable
  versions. Use `pnpm install --frozen-lockfile`, `pnpm audit` / Dependabot / Snyk in CI, and verify
  every new dependency actually exists and is the one you think it is.
- **Dead-code elimination** — **Knip** (JS/TS) finds unused files, exports, types and dependencies
  across the workspace (monorepo-aware; auto-detects Next/Vite and `pnpm` workspaces). Drop a
  `knip.json` at the repo root (zero-config to start: `{ "$schema": "https://unpkg.com/knip@5/schema.json" }`)
  and run `pnpm dlx knip` — or add a `"knip"` script once you want it in the loop. Pruning dead code
  shrinks the surface every session (and the AI) has to reason about and keeps `package.json` honest,
  complementing the dependency audit above. AI-written code accretes orphaned helpers and unused
  exports fast, so run it periodically on web projects.

**Process rule (worth more than any tool): don't let the AI define the acceptance criteria.** You
write or review the important test cases yourself — at least the key asserts and the requirement's
edge cases — and have the AI implement against them. That breaks the loop where the same
misunderstanding lives in both the test and the code. Mutation testing is the automated backstop for
this, but the judgment about *what the system should do* stays yours.

Priority by immediate payoff: **mutation + property-based testing first** (they hit the current blind
spot), then **runtime validation and a couple of E2E smoke tests**.

---

## Real-environment verification — what no in-process test can prove

Vitest, fast-check and Stryker all run in Node. Node is not a browser, and **the product here is not
`src/` — it is the single `dist/index.html` a stranger opens from a USB stick, offline, on a machine
you have never seen.** The two properties this project actually promises are exactly the two no
in-process test can establish:

1. **It never issues a network request.** A unit test cannot prove a negative about the network. Only
   loading the built artifact in a real browser, with the network panel open and the machine actually
   offline, does.
2. **A share produced on one machine recombines on another.** Round-tripping inside one process
   proves the code is self-consistent, not that Chrome and Firefox, desktop and phone, agree.

**Write those checks as a script, commit it, and name it here.** It runs by hand with no arguments,
prints a per-phase `PASS`/`FAIL`, and exits non-zero on the first failure. The Playwright suite over
`file://` is the automated half; the manual half below is the part that cannot be automated away.

What "real environment" means here, concretely:

- **The built artifact over `file://`**, never a dev server. `dist/index.html` with JS and CSS
  inlined is the shipped product; anything that only works when served over HTTP is a bug.
- **A real browser, headed, with the network panel open** — and then again with the machine genuinely
  offline (airplane mode / `nmcli networking off`), not merely "no requests observed".
- **Both engines and a real phone.** Chromium and Firefox already run in CI; add one real mobile
  browser. `file://` semantics, `crypto.subtle` availability, clipboard permission and
  `<a download>` behaviour differ per engine and per platform, and none of those differences exist
  in Node.
- **Cross-machine round trip.** Split on one device, combine on another, with the shares carried by
  hand. That is how the tool is used.

### The names, so you can ask for them by name

| Name | What it means here |
| --- | --- |
| **E2E / on-device acceptance test** | Drives the built `dist/index.html` in a real browser and asserts on observable behaviour — the recombined secret, zero network requests, the file that landed in Downloads — never on internals. |
| **Contract test** | Checks that assumptions about a dependency or a platform actually hold. `shamir-secret-sharing` is pinned **exactly to 0.0.4** because that is the audited version; a contract test is what proves a bump did not change the wire format — split with the old version, combine with the new. Platform side: is `crypto.subtle` present on a `file://` origin in this browser; does `<a download>` fire; does the clipboard API work without a secure context. |
| **Mutation testing** (out of process: by hand) | Revert the fix, re-run the check, confirm it goes red, restore. Stryker automates this for `src/core`; for a browser or platform check you do it manually. **A check that has never failed has not been tested** — in particular, a "no network requests" assertion that has never seen a build that *does* make one proves nothing. |
| **State-invariant test** | Asserts a relationship **between two things** no single unit test owns: the built artifact versus its source (does `dist/index.html` actually contain the pinned library and its OFL/Apache notice?); a share's threshold metadata versus the share set it belongs to. Each side is individually fine; the pair is what breaks. |
| **Test pollution / isolation leak** | A test writing state that outlives it — a real secret left in `/tmp`, in the browser profile, in the clipboard, or in shell history. For a secret-sharing tool this is not a flaky-test problem, it is the threat model. Use throwaway values; never a real key. |

### Rules that came out of real bugs, not theory

- **Prove every new check can fail before you trust it green.** Revert the fix, watch it go red,
  restore. Applies to unit tests written after the fact *and* to browser checks. A green you have
  never seen turn red is not evidence.
- **Never assert on a count you cannot predict.** A threshold-shaped assertion ("fewer than N
  requests", "under N ms", "at least N bytes of entropy") passes against a deliberately broken build
  as soon as the environment shifts — the magnitude depends on the machine, not on the bug. Assert
  the **invariant**: *zero* requests, `combine(split(x, n, k))` equals `x` for any `k` of `n`, any
  `k-1` shares reveal nothing, the artifact is one file.
- **A pinned dependency's audit is part of the contract.** `shamir-secret-sharing` 0.0.4 and
  TypeScript 5.x are pinned for reasons written down in `docs/FINDINGS.md`; bumping either without
  re-reading the audits or re-checking the mutation gate silently removes a guarantee. Nothing fails.
- **A test must not touch anything real.** No real secrets, no real key material, no writes outside a
  throwaway directory — and restore in a teardown that runs even when the test fails.
- **Run the suite the way that actually works on this machine**, not the way the docs say, and always
  under the memory cgroup (see *Heavy jobs*) — Stryker is the job that OOMs boxes:

  ```bash
  systemd-run --user --scope --quiet -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- \
    pnpm build && pnpm test:e2e
  scripts/verify-<flow>.sh    # offline, headed, real-browser check against dist/index.html
  ```

---

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

## CI & git hooks

**Policy — the heavy gate runs locally on push; CI re-checks it on the PR and owns the release.**

- **Git hooks** (`.githooks/`) — install once per clone: `git config core.hooksPath .githooks`.
  - **pre-push** — `pnpm type-check`, `pnpm test:cov`, then **`pnpm test:mutation`** (slowest last;
    mutating over a red suite tells you nothing), all inside the memory cgroup. E2E stays out of the
    hook on purpose: it needs installed browsers, and CI runs it against the built artifact.
    Bypass: `git push --no-verify`, and then the breakage is yours.
- **Still run `pnpm test:all` by hand** before a release push — the hook covers everything except
  E2E. Wrap the heavy suites (coverage, mutation, Playwright) in the memory cgroup from the section
  above — always, no exceptions.
- **`.github/workflows/ci.yml`** (pushes to `main` + every PR) — blocking dependency audit,
  `type-check`, `test:cov`, Playwright E2E against the built artifact, and the check that the
  committed `dist/index.html` matches a fresh build. On **PRs only** it also runs
  **`pnpm test:mutation`**, `continue-on-error` for now, uploading `reports/mutation/` as an artifact
  (a bare percentage is not actionable; the survivor list is). Drop `continue-on-error` — and write
  the date here — once the score has cleared `thresholds.break` on two consecutive runs.
- **`.github/workflows/release.yml`**, triggered by a `v*` tag. It builds
  `dist/index.html` **from source** and attaches it plus `sha256sums.txt` to the GitHub Release, so a
  user can verify the artifact they download matches the tagged source. **The user creates and pushes
  the tag — the agent never pushes.**
- **If PR CI is ever added, keep it lean:** `pnpm type-check` only, plus a **blocking** dependency
  audit per the governance above (`pnpm install --frozen-lockfile` to prove the lockfile is honest,
  then `pnpm audit --prod --audit-level high`, no `continue-on-error`). Fix a failing audit by
  bumping — never by lowering `--audit-level`, and never by unpinning the crypto library.

---

## Agentic PR verification (MANDATORY on every PR)

**Every PR MUST be verified end-to-end before merge, and the verdict MUST be posted as a PR comment**
(`gh pr comment`). Running the pass and posting the verdict is **not optional**. Once a PR exists, a
headless agent **drives the running app end-to-end** and posts the verdict, then **waits for you to
close/merge**. Its job is to catch what diffs and unit tests miss: missing buttons, unimplemented
content, dead flows, screens that don't match the spec. The verdict is informational for gating (it
never merges anything) — but producing it on every PR is required.

- **Local & headless.** Runs on your machine via `claude -p` (headless/print mode), posts with
  `gh pr comment`. No CI minutes, no repo secrets. Fits an unattended loop.
- **Two surfaces, two engines** (one orchestrator picks by which paths the PR touched):
  - **Web** → **Playwright MCP** (headless Chromium) against `localhost`.
  - **Native mobile (Compose / SwiftUI)** → **mobile-mcp** — the mobile counterpart to Playwright MCP:
    it navigates the native **accessibility tree** over `adb` and only falls back to screenshot
    coordinates when labels are missing, so it's more deterministic than a vision-only approach. Run it
    against an **emulator or a dedicated test device**. Alternative with more stable locators:
    **appium-mcp** (UiAutomator2 / XCUITest drivers). iOS analog via the XCUITest driver.
  - **Any other runnable surface** generalizes the same way — Playwright covers any web app;
    Python / API smoke via `pytest` + `httpx`.
- **Reliability key = semantics.** Agentic navigation is only as reliable as the accessibility layer:
  good ARIA roles on web, `Modifier.testTag(...)` / `contentDescription` / `Modifier.semantics { }` on
  Compose. Without labels the agent falls back to fragile screenshot coordinates. **Audit that the
  flows you verify are labeled** before relying on this.
- **Two layers.** Deterministic tests (Playwright specs on web, Espresso/Compose on mobile) are the
  **hard merge gate** — they already ran and passed pre-push, so the PR arrives with its flows
  proven. The agentic pass is **advisory**: it explores the new surface, **writes the regression
  specs that are missing** (a flow the agent had to discover by hand is a flow with no spec — that's
  a finding, report it), and leaves a readable verdict. Because the agent is
  non-deterministic, it **never vetoes a merge on its own** — its value is coverage and a legible
  report, not gatekeeping.
- **Cases come from the spec.** Draw the scenarios from the spec's `## Cases` / `## Casuísticas` block;
  tag them `[web]` / `[mobile]` when one spec covers both surfaces.
- **Trigger.** It's the **last step of the superpowers pipeline, right after a PR exists**:
  - **"modo desatendido"** — the agent pushes the branch, opens the PR, and fires verification itself.
  - **"normal mode"** — you open the PR; the agent then runs the local `verify-pr.sh` and posts the
    verdict (**mandatory before merge**, not merely on request — running the script + `gh pr comment`
    needs no push, so this respects the never-push default). Runnable by hand anytime.
- **Hard limits** (these do not relax in any mode): the verdict **awaits your close** and the agent
  **never merges** — see **Git & GitHub**. Point it at a **dedicated emulator / test device, never your
  daily phone**. Scope `--allowedTools` to exactly what the run needs; `--dangerously-skip-permissions`
  only in a controlled local env, never as a habit. Confirm flag names with `claude -p --help`.

**In this project there is no stack to boot and no `localhost`.** The surface the agent drives is the
built `dist/index.html` opened over `file://` — so the orchestrator's web branch runs `pnpm build`
first and points Playwright MCP at the `file://` URL of the artifact.

---

## Working rules

- **Heavy or parallel jobs run inside a memory cgroup** — never launch a suite, build or
  fan-out on a bare estimate; wrap it in
  `systemd-run --user --scope -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>`
  and cap the tool's own concurrency too.
- **Use superpowers skills whenever they apply** — invoke via `Skill` before acting; process skills
  before implementation skills.
- **Don't install packages without asking** — the stack is intentional. Exception: obvious test devDeps.
- **TDD by default** for new logic. Don't merge logic without tests.
- **Every user-facing flow ships with a Playwright E2E** that drives the real built artifact over
  `file://`. Unit tests green ≠ it works — the recurring failure mode is a feature that renders fine
  and then breaks on the first real click. Blocking before push.
- **Don't lower the coverage gate** — exclude with justification instead.
- **No `any`** — `unknown` + type guards or domain types.
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
  "planned", update the Stack tables and module list in the same change. A stale `CLAUDE.md` misleads
  the next session.
- **UI work → design context first, then `impeccable` + superpowers** — for any UI/frontend change,
  invoke the `impeccable` skill (and its sub-skills: `shape`, `polish`, `critique`, etc.). First, if
  the project has no design context yet (`PRODUCT.md` / `DESIGN.md` at the root), run the impeccable
  `teach` flow (`$impeccable teach`) — it explores the codebase and then interviews you about the
  project's direction and writes `PRODUCT.md` (strategic) + `DESIGN.md` (visual) (auto-migrating a
  legacy `.impeccable.md` to `PRODUCT.md`). **Never hand-author the design context — `teach` gets it
  from you, not from the AI guessing.** Don't hand-roll UI without impeccable + superpowers.
- **Commits in English**, Conventional Commits. Scope = module/folder.

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
