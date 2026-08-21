/**
 * Builds the one artifact this project ships: dist/index.html, with the JavaScript
 * and the CSS inlined and nothing referenced from outside the file.
 *
 * The assertions at the bottom are not decoration. They are the build-time half of
 * the zero-network invariant, and a failure here means the artifact must not ship.
 */

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

const FORBIDDEN_TOKENS = ['node:crypto', 'crypto.subtle', 'require("crypto")', "require('crypto')"];

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

  for (const token of FORBIDDEN_TOKENS) {
    if (html.includes(token)) {
      fail(`the artifact contains "${token}" — it must never reach the browser bundle`);
    }
  }

  let scannable = html;
  for (const allowed of ALLOWED_URLS) {
    scannable = scannable.split(allowed).join('');
  }
  const leaks = scannable.match(/https?:\/\/[^\s"'<>)]*/g);
  if (leaks) {
    fail(`the artifact references remote URLs: ${[...new Set(leaks)].join(', ')}`);
  }

  if (!html.includes('http-equiv="Content-Security-Policy"')) {
    fail('the Content-Security-Policy meta tag is missing');
  }
  if (!html.toLowerCase().startsWith('<!doctype html>')) {
    fail('the artifact does not start with a doctype');
  }

  const scripts = html.match(/<script\b/g) ?? [];
  const styles = html.match(/<style\b/g) ?? [];
  if (scripts.length !== 1) fail(`expected exactly one <script>, found ${scripts.length}`);
  if (styles.length !== 1) fail(`expected exactly one <style>, found ${styles.length}`);

  for (const marker of ['<!-- inject:css -->', '<!-- inject:js -->', '<!-- inject:license -->']) {
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

  const html = template
    .replace('<!-- inject:license -->', escapeHtml(license.trim()))
    .replace('<!-- inject:css -->', `<style>${styles.trim()}</style>`)
    .replace('<!-- inject:js -->', `<script>${script.trim()}</script>`);

  assertSelfContained(html, script);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');

  const bytes = Buffer.byteLength(html, 'utf8');
  const gzipped = gzipSync(html).byteLength;
  const kb = (value) => `${(value / 1024).toFixed(1)} KB`;
  console.log(`dist/index.html  ${kb(bytes)}  (${kb(gzipped)} gzipped)  — self-contained, no URLs`);
}

await main();
