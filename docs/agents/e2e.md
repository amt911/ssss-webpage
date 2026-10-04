# E2E — Playwright

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

## E2E — Playwright

### E2E (Playwright) — mandatory

**Why this is a hard rule.** Unit tests pass while the product is broken: the component renders, the
type-check is green, and then a real click hits an endpoint that doesn't exist, sends the wrong
payload shape, or returns 500. Mocked fetches hide exactly that class of bug, because the mock
encodes what the author *assumed* the API does. Only driving the running app against the real API
proves the feature works.

- **Every main journey needs a spec** — the path a user actually walks end to end. A slice with UI is
  not done until its journey has a Playwright spec; the edge cases go one layer down (see
  [The pyramid per feature](../../AGENTS.md#the-pyramid-per-feature--one-e2e-per-journey-the-rest-one-layer-down)).
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
  [Agentic PR verification](pr-verification.md#agentic-pr-verification-mandatory-on-every-pr)).
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
[CI & git hooks](ci-and-hooks.md#ci--git-hooks)): the gate is `pnpm test:all` run locally before you push.
