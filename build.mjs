/**
 * Builds the one artifact this project ships: dist/index.html, with the JavaScript
 * and the CSS inlined and nothing referenced from outside the file.
 *
 * The assertions at the bottom are not decoration. They are the build-time half of
 * the zero-network invariant, and a failure here means the artifact must not ship.
 */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const templatePath = join(root, 'src', 'index.html');
const outputPath = join(root, 'dist', 'index.html');
const licensePath = join(root, 'node_modules', 'shamir-secret-sharing', 'LICENSE');

/**
 * The Apache-2.0 text itself carries these. Everything else matching a URL is a
 * bug: it would mean the page can reach off the machine. Longest first, so the
 * shorter prefix does not strand a fragment of the longer one.
 */
const ALLOWED_URLS = [
  'http://www.apache.org/licenses/LICENSE-2.0',
  'http://www.apache.org/licenses/',
];

/**
 * Tokens that must never appear in the shipped page, grouped by what they would
 * break. The page needs none of them, so their absence is easy to enforce and
 * makes the guarantee static rather than a property someone has to keep noticing.
 */
const FORBIDDEN_TOKENS = {
  'the wrong crypto backend': ['node:crypto', 'require("crypto")', "require('crypto')"],

  // Available over file:// — that is a secure context in both engines — but using
  // it would tie the page's core function to secure-context status, which is
  // browser policy rather than law. See the note in src/core/crc32.ts.
  'a dependency on secure-context status': ['crypto.subtle'],

  // All of these are blocked by the CSP as well; forbidding them means the page
  // does not rely on the CSP alone for the things the CSP does cover.
  'a network channel': [
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'sendBeacon',
    'serviceWorker',
    'RTCPeerConnection',
    'importScripts',
    'fetch(',
  ],

  // A top-level navigation carries data in the URL and is the one exfiltration
  // channel a CSP cannot close: `navigate-to` was dropped from the spec and no
  // browser implements it, while `sandbox` is ignored in a <meta> policy. So the
  // guarantee has to be that the shipped code contains no way to navigate at all.
  'a navigation away from the page': [
    'location.href',
    'location.assign',
    'location.replace',
    'document.location',
    'window.open',
  ],

  // No user input is ever parsed as markup, so nothing above is reachable even
  // in principle. This keeps it that way.
  'an HTML or script injection sink': [
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'document.write',
    'eval(',
    'new Function',
  ],
};

/** `<meta http-equiv="refresh">` navigates without any script at all. */
const META_REFRESH = /http-equiv\s*=\s*["']?\s*refresh/i;

/**
 * Every attribute a browser will dereference. The artifact is allowed exactly two
 * kinds of value: `data:` (the empty favicon) and a `#` fragment. Anything else is
 * a resource load or a navigation, and both are ways off this machine.
 */
const URL_ATTRIBUTES =
  /\s(?:href|src|srcset|ping|action|formaction|poster|data|background|cite|manifest|longdesc)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Case-insensitive: `HTTP://` is a URL too, and browsers do not care about case. */
const URL_PATTERN = /https?:\/\/[^\s"'<>)]*/gi;

function sha256Base64(text) {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

/**
 * Hashing the inlined blocks rather than allowing `'unsafe-inline'` turns the
 * policy into an integrity check on this exact artifact: any other inline script,
 * including an injected event-handler attribute, is refused by the browser.
 */
function contentSecurityPolicy(script, styles) {
  return [
    "default-src 'none'",
    `script-src 'sha256-${sha256Base64(script)}'`,
    `style-src 'sha256-${sha256Base64(styles)}'`,
    'img-src data:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fail(message) {
  console.error(`\nBuild failed: ${message}\n`);
  process.exit(1);
}

async function bundleScript() {
  const result = await esbuild.build({
    entryPoints: [join(root, 'src', 'app.ts')],
    bundle: true,
    write: false,
    // A classic IIFE, never an ES module: Chrome refuses module scripts over file://.
    format: 'iife',
    // Must stay 'browser'. Under the node condition the library resolves its
    // Node CSPRNG, which imports node:crypto and breaks the page.
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'inline',
  });
  const [file] = result.outputFiles;
  if (!file) fail('esbuild produced no JavaScript output');
  return file.text;
}

async function bundleStyles() {
  const result = await esbuild.build({
    entryPoints: [join(root, 'src', 'styles.css')],
    bundle: true,
    write: false,
    minify: true,
  });
  const [file] = result.outputFiles;
  if (!file) fail('esbuild produced no CSS output');
  return file.text;
}

function assertSelfContained(html, script) {
  if (script.includes('</script')) {
    fail('the bundle contains a literal </script sequence and cannot be inlined safely');
  }

  for (const [reason, tokens] of Object.entries(FORBIDDEN_TOKENS)) {
    for (const token of tokens) {
      if (html.includes(token)) {
        fail(`the artifact contains "${token}", which would give it ${reason}`);
      }
    }
  }

  if (META_REFRESH.test(html)) {
    fail('the artifact contains a meta refresh, which can navigate off the page');
  }

  // A named control joins the form data set. If the page's JavaScript ever fails
  // to attach its submit handlers, the browser performs a native submit; the CSP
  // blocks the navigation, but Chromium logs the whole blocked URL — secret and
  // all — to the console. Nameless controls have nothing to put in that URL.
  const namedControls = [...html.matchAll(/<(?:input|textarea|select|button)\b[^>]*/gi)]
    .map((match) => match[0])
    .filter((tag) => /\sname\s*=/i.test(tag));
  if (namedControls.length > 0) {
    fail(`form controls carry a name attribute: ${namedControls.join(' | ').slice(0, 200)}`);
  }

  // Extract first, then compare whole URLs. Stripping the allowed prefixes before
  // scanning would let `http://www.apache.org/licenses/../../evil?q=secret` pass,
  // because the prefix would be deleted from the middle of a real URL.
  const leaks = [...new Set(html.match(URL_PATTERN) ?? [])].filter(
    (url) => !ALLOWED_URLS.includes(url),
  );
  if (leaks.length > 0) {
    fail(`the artifact references remote URLs: ${leaks.join(', ')}`);
  }

  // A URL scan alone is not enough: a `<a href>` or `<img src>` needs no script
  // and can carry data in the URL, and obfuscation defeats any regex.
  for (const match of html.matchAll(URL_ATTRIBUTES)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!/^(?:data:|#)/i.test(value)) {
      fail(`the artifact has a dereferenceable attribute "${match[0].trim()}"`);
    }
  }

  const policies = [
    ...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/gi),
  ].map((match) => match[1] ?? '');

  if (policies.length !== 1) {
    fail(`expected exactly one Content-Security-Policy meta tag, found ${policies.length}`);
  }
  const [policy] = policies;
  for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", '*']) {
    if (policy.includes(unsafe)) {
      fail(`the policy contains ${unsafe}; the inlined blocks must be pinned by hash`);
    }
  }
  for (const directive of ["default-src 'none'", 'sha256-', "base-uri 'none'", "form-action 'none'"]) {
    if (!policy.includes(directive)) {
      fail(`the policy is missing ${directive}`);
    }
  }
  if (!html.toLowerCase().startsWith('<!doctype html>')) {
    fail('the artifact does not start with a doctype');
  }

  const scripts = html.match(/<script\b/g) ?? [];
  const styles = html.match(/<style\b/g) ?? [];
  if (scripts.length !== 1) fail(`expected exactly one <script>, found ${scripts.length}`);
  if (styles.length !== 1) fail(`expected exactly one <style>, found ${styles.length}`);

  for (const marker of [
    '<!-- inject:csp -->',
    '<!-- inject:css -->',
    '<!-- inject:js -->',
    '<!-- inject:license -->',
  ]) {
    if (html.includes(marker)) fail(`injection marker ${marker} was left unreplaced`);
  }
}

async function main() {
  const [template, license, script, styles] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readFile(licensePath, 'utf8'),
    bundleScript(),
    bundleStyles(),
  ]);

  // Hashed over exactly the text that ends up between the tags — a stray byte of
  // difference and the browser refuses to run the page at all.
  const inlineScript = script.trim();
  const inlineStyles = styles.trim();
  const policy = contentSecurityPolicy(inlineScript, inlineStyles);

  // Function replacements, not string ones: a string replacement treats `$$`,
  // `` $` ``, `$'` and `$&` in the *replacement* as substitution patterns, and
  // esbuild's identifier alphabet includes `$`. A minified `var $$=…` would land
  // in the page as `var $=…`, silently rebinding a live function in the crypto
  // code. A function replacement is inserted verbatim.
  const html = template
    .replace(
      '<!-- inject:csp -->',
      () => `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
    )
    .replace('<!-- inject:license -->', () => escapeHtml(license.trim()))
    .replace('<!-- inject:css -->', () => `<style>${inlineStyles}</style>`)
    .replace('<!-- inject:js -->', () => `<script>${inlineScript}</script>`);

  assertSelfContained(html, script);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');

  const bytes = Buffer.byteLength(html, 'utf8');
  const gzipped = gzipSync(html).byteLength;
  const kb = (value) => `${(value / 1024).toFixed(1)} KB`;
  console.log(`dist/index.html  ${kb(bytes)}  (${kb(gzipped)} gzipped)  — self-contained, no URLs`);
}

await main();
