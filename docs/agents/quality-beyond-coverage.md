# Quality beyond coverage

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
  [E2E (Playwright) — mandatory](e2e.md#e2e-playwright--mandatory).
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
