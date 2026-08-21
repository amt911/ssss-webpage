# Findings

Non-obvious things that cost time and are **not deducible from reading the code**. If you discover a
gotcha that would have saved you an hour, add a short entry here — what happened, and what to do
about it. Read this before debugging or touching the build.

---

## 1. `crypto.subtle` is undefined over `file://` in Chrome

**What happened.** `file://` is not a *secure context* in Chrome, and `SubtleCrypto` is gated behind
secure contexts. So `crypto.subtle` is `undefined` when the artifact is opened by double-clicking it —
while `crypto.getRandomValues` remains available, because it is not gated the same way. Code that
worked when served over `http://localhost` broke the moment it ran the way users actually run it.

**What to do.** `crypto.subtle` is **banned project-wide**. Integrity uses a hand-rolled CRC32
(`src/core/crc32.ts`) rather than SHA-256 precisely because of this. Randomness comes from
`crypto.getRandomValues`, called inside the library. Never test only over `http://` — the E2E suite
drives `file://` for exactly this reason.

## 2. esbuild must not resolve the `node` export condition

**What happened.** `shamir-secret-sharing` ships a Node CSPRNG variant that does
`import { randomBytes } from "node:crypto"`. Bundling with `platform: 'node'` — or with any custom
condition set that contains `node` — resolves that variant and produces an artifact that is broken in
the browser, with a failure that only shows up at runtime.

**What to do.** `build.mjs` uses `platform: 'browser'`, and the post-build scan asserts that the
string `node:crypto` does not appear anywhere in `dist/index.html`. Both guards exist for this one
bug; don't relax either while "just trying something".

## 3. `combine()` below the threshold returns wrong bytes silently

**What happened.** The threshold is not encoded in the shares, so the library has no way to know it
was given too few. Calling `combine()` with fewer shares than the threshold does not throw — it
returns a perfectly plausible-looking `Uint8Array` of garbage. Cure53's report flags this and
recommends an application-level integrity tag.

**What to do.** Ours is the payload header `[version 0x01][CRC32 big-endian]`, written by
`encodePayload` and verified by `decodePayload` (`src/core/payload.ts`). If the CRC does not match, we
refuse to render anything. Residual false-accept probability is about 2^-40. Be precise about what
this buys: it detects **accidents** — wrong, insufficient or corrupted shares — and it is explicitly
**not tamper-proofing**, since anyone who can alter a share can recompute the CRC. The UI wording in
the Security notes says exactly that, and should keep saying it.

## 4. Chrome blocks ES module scripts over `file://`

**What happened.** A `<script type="module">` is fetched under CORS rules, and `file://` URLs fail
that check — so the module never executes and the page is inert, with only a console error to show
for it.

**What to do.** The bundle is emitted as a **classic IIFE script** (`format: 'iife'`) and inlined into
the HTML. Never switch the output to `esm`, and never add `type="module"` to the inlined `<script>`.

## 5. `btoa(String.fromCharCode(...bytes))` overflows the call stack on large inputs

**What happened.** Spreading a large `Uint8Array` into `String.fromCharCode` passes one argument per
byte and blows past the engine's argument limit, throwing `RangeError: Maximum call stack size
exceeded`. It works fine for small secrets, so it survives every hand-written test and fails on a real
one.

**What to do.** `bytesToBase64` (`src/core/base64.ts`) converts in chunks of about 8 KB. The
fast-check property test deliberately generates inputs up to 20 000 bytes to keep this path covered —
don't shrink that bound to make the suite faster.

## 6. `npm` is a shell alias for pnpm on this machine

**What happened.** Running `npm install` here writes `pnpm-lock.yaml`, not `package-lock.json`,
because `npm` is aliased to `pnpm` in the user's shell. Commands copied from generic docs appear to
work and quietly do something else.

**What to do.** The project standardises on **pnpm**: `pnpm-lock.yaml` is the committed lockfile,
`packageManager` is pinned in `package.json`, and every command in the docs is a `pnpm` command. The
release workflow installs pnpm explicitly and runs `pnpm install --frozen-lockfile` rather than
relying on `npm ci`, which would behave differently (or not at all) on a machine without the alias.

## 7. TypeScript 7 removes the compiler API Stryker needs

**What happened.** Installing `typescript` at latest brought in 7.0.2, the native port. Type-checking
was fine, but `pnpm test:mutation` died immediately with `TypeError:
ts.parseConfigFileTextToJson is not a function` — Stryker rewrites `tsconfig.json` for its sandbox
using the old JS compiler API, and 7.x no longer exposes it (`parseJsonConfigFileContent` is gone
too). Nothing about the failure points at TypeScript, so it reads like a Stryker bug.

**What to do.** The project pins `typescript` to **5.x**. Nothing here is emitted by `tsc` — it only
type-checks — so 7.x buys nothing and costs the mutation gate. Before bumping, run
`pnpm test:mutation`, not just `pnpm type-check`.

## 8. Stryker cannot find its plugins under pnpm

**What happened.** With TypeScript fixed, Stryker then failed with `Cannot find TestRunner plugin
"vitest". In fact, no TestRunner plugins were loaded.` The plugin was installed and visible in
`node_modules`. Stryker's default `plugins` setting is the glob `@stryker-mutator/*`, which it
resolves by walking `node_modules` — and pnpm's isolated layout puts the real packages under
`node_modules/.pnpm/...`, so the glob matches nothing.

**What to do.** `stryker.config.json` names the plugin explicitly:
`"plugins": ["@stryker-mutator/vitest-runner"]`. Resolution by name goes through the normal module
resolver and works. Any future Stryker plugin has to be added to that array by hand.

## 9. pnpm 11 reads settings from `pnpm-workspace.yaml`, not `package.json`

**What happened.** A `"pnpm": { "onlyBuiltDependencies": [...] }` block in `package.json` was ignored
with a warning, and every command that triggers an install check then failed outright with
`ERR_PNPM_IGNORED_BUILDS` because esbuild's install script was not approved. The setting was also
renamed: `onlyBuiltDependencies` (a list) became `allowBuilds` (a map).

**What to do.** Settings live in `pnpm-workspace.yaml` at the repo root, which carries
`allowBuilds: { esbuild: true }`. esbuild's install script is required — it resolves the
platform-specific binary the build depends on.

## 10. Four mutants in `src/core` survive on purpose

**What happened.** The mutation score sits at 98.5%, not 100%, and the four survivors cannot be
killed because they are **equivalent mutants** — the mutated code behaves identically:

- `base64.ts`, both `index < length` loop bounds flipped to `<=`: the extra iteration either appends
  an empty chunk or writes past the end of a `Uint8Array`, which is a silent no-op.
- `crc32.ts`, `index < 256` flipped to `<=`: writes `table[256]` on a `Uint32Array(256)`, again a
  silent no-op.
- `shareCodec.ts`, `/\s+/g` narrowed to `/\s/g`: with the global flag both strip all whitespace.

**What to do.** Leave them. Don't add a test that pretends to kill them, and don't restructure
working code to satisfy the counter. If a *new* survivor appears, it is a real gap until proven
otherwise — the break threshold is 85, so the suite still has room before it fails.
