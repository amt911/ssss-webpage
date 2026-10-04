# Agentic PR verification

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
- **The verdict reads structure too.** Besides driving the built artifact, it names what the diff does
  to the [Design principles](design-principles.md#design-principles--solid-applied-with-judgement): `src/ui` code reaching
  for `fetch`/IO it shouldn't have, a growing `if`/`switch` chain that should be a table, or a new
  interface with only one implementation. Findings, not a veto — like the rest of the pass.
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
