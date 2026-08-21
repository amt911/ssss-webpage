# ssss-webpage

A single HTML file that splits a secret into shares and puts it back together —
[Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) with nothing
around it. No server, no build to run, no network. Open the file and use it.

## Get it

Download `index.html` from the [latest release](../../releases/latest). Verify it against the
`sha256sums.txt` published alongside it:

```bash
sha256sum -c sha256sums.txt
```

Then open the file in a browser. Double-clicking it works; so does an air-gapped machine with the
network switched off, which is how it is meant to be used. A copy of the same artifact also lives in
[`dist/index.html`](dist/index.html) in this repository.

## What it does

- **Split** a text secret into 2–255 shares, with a threshold of how many are needed to recover it.
- **Combine** any set of at least that many shares back into the original text.

Everything runs in the page. Nothing is uploaded, nothing is stored, and reloading discards all of
it. The page carries a `Content-Security-Policy` that blocks every outbound request, and the test
suite fails if the page ever makes one.

## What it will not do for you

Shares below the threshold reveal nothing about the secret — that part is mathematics. The rest is
your handling of them: keep shares in different places, and remember that a page cannot defend
against malware, a clipboard manager, or somebody reading over your shoulder.

Each secret carries a CRC-32 checksum, so recovering with too few, mistyped or mismatched shares
fails with an error instead of returning convincing nonsense. That catches accidents, not attackers:
anyone who can alter a share can recompute the checksum.

## Under the hood

The cryptography is [`shamir-secret-sharing`](https://github.com/privy-io/shamir-secret-sharing)
`0.0.4` by Privy — audited by Cure53 and Zellic, zero dependencies, Apache-2.0 — pinned to the exact
audited version and bundled unmodified. Everything else is about 500 lines of TypeScript with no
framework.

## Working on it

Requires Node ≥ 20 and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox   # one-time, for the E2E suite

pnpm build           # writes dist/index.html and asserts it is self-contained
pnpm test            # unit and property tests
pnpm test:e2e        # rebuilds, then drives the real file:// page in two browsers
pnpm test:mutation   # mutation testing over src/core
pnpm test:all        # the full gate
```

There is no dev server on purpose: the thing you develop is the thing you ship, so you open
`dist/index.html` exactly like a user would. `dist/index.html` is committed and must be rebuilt in
the same commit as any change under `src/`.

See [CLAUDE.md](CLAUDE.md) for the working rules, [design-system.md](design-system.md) for the visual
language, and [docs/FINDINGS.md](docs/FINDINGS.md) for the non-obvious things that cost someone time.

## Releasing

Push a `v*` tag. The [release workflow](.github/workflows/release.yml) rebuilds from source, checks
the committed artifact matches, and attaches `index.html` plus its checksum to the release.

## License

Apache-2.0. The bundled library is Apache-2.0 too, Copyright 2023 Horkos, Inc.; its full license text
is reproduced inside the page under "Licenses".
