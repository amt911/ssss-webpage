# Real-environment verification

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
