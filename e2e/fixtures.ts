import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { test as base, expect } from '@playwright/test';

/**
 * Every spec runs against the real built artifact opened over file://, and every
 * spec inherits two guards it cannot forget to add: the page must issue no
 * network request, and it must log no errors.
 */

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const ARTIFACT_URL = pathToFileURL(join(repoRoot, 'dist', 'index.html')).href;

/** Schemes that never leave the machine. Anything else counts as a network call. */
const LOCAL_SCHEMES = ['file:', 'data:', 'blob:'];

class PageGuards {
  readonly remoteRequests: string[] = [];
  readonly consoleErrors: string[] = [];
  private readonly allowedRequests: RegExp[] = [];
  private readonly allowedErrors: RegExp[] = [];

  /** For the CSP canary only: a request the test deliberately provokes. */
  allowRemoteRequest(pattern: RegExp): void {
    this.allowedRequests.push(pattern);
  }

  /** For the CSP canary only: the violation message the browser is meant to log. */
  allowConsoleError(pattern: RegExp): void {
    this.allowedErrors.push(pattern);
  }

  unexpectedRequests(): string[] {
    return this.remoteRequests.filter(
      (entry) => !this.allowedRequests.some((pattern) => pattern.test(entry)),
    );
  }

  unexpectedConsoleErrors(): string[] {
    return this.consoleErrors.filter(
      (entry) => !this.allowedErrors.some((pattern) => pattern.test(entry)),
    );
  }
}

export const test = base.extend<{ guards: PageGuards }>({
  guards: async ({}, use) => {
    await use(new PageGuards());
  },

  page: async ({ page, guards }, use) => {
    page.on('request', (request) => {
      const url = request.url();
      if (!LOCAL_SCHEMES.some((scheme) => url.startsWith(scheme))) {
        guards.remoteRequests.push(`${request.method()} ${url}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        guards.consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      guards.consoleErrors.push(error.message);
    });

    await page.goto(ARTIFACT_URL);
    await use(page);

    expect(guards.unexpectedRequests(), 'the page must never reach the network').toEqual([]);
    expect(guards.unexpectedConsoleErrors(), 'the page must not log errors').toEqual([]);
  },
});

export { expect };

/** Flips one Base64 character inside a share, leaving the prefix intact. */
export function corruptShare(share: string): string {
  const index = 12;
  const original = share[index];
  const replacement = original === 'A' ? 'B' : 'A';
  return share.slice(0, index) + replacement + share.slice(index + 1);
}

export const field = {
  secret: 'Secret',
  shareCount: 'Number of shares',
  threshold: 'Threshold',
  shareInput: 'Shares, one per line',
  recovered: 'Recovered secret',
} as const;
