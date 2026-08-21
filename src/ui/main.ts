import { explainError } from '../core/errors';
import { combineShares, splitSecret } from '../core/sss';
import { secretSizeWarning } from '../core/validate';

/**
 * DOM wiring. Deliberately thin: every decision worth testing lives in src/core,
 * and this layer is proven end to end by Playwright against the built page.
 *
 * Two rules hold throughout: no storage API is ever touched, and no secret or
 * share value is ever written to the console.
 */

const COPY_FEEDBACK_MS = 1500;
const COPY_LABEL = 'Copy';

const encoder = new TextEncoder();
const copyTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

function element<T extends Element>(doc: Document, id: string, ctor: new () => T): T {
  const found = doc.getElementById(id);
  if (!(found instanceof ctor)) {
    throw new Error(`Expected #${id} to be a ${ctor.name}`);
  }
  return found;
}

function showError(node: HTMLElement, message: string): void {
  node.textContent = `⚠ ${message}`;
  node.hidden = false;
}

function hideError(node: HTMLElement): void {
  node.textContent = '';
  node.hidden = true;
}

function setBusy(button: HTMLButtonElement, label: string, isBusy: boolean): void {
  button.textContent = label;
  button.disabled = isBusy;
  if (isBusy) {
    button.setAttribute('aria-busy', 'true');
  } else {
    button.removeAttribute('aria-busy');
  }
}

function setCopyState(button: HTMLButtonElement, label: string, modifier: string): void {
  const pending = copyTimers.get(button);
  if (pending !== undefined) {
    clearTimeout(pending);
  }

  button.textContent = label;
  button.classList.remove('copy--copied', 'copy--failed');
  button.classList.add(modifier);

  copyTimers.set(
    button,
    setTimeout(() => {
      button.textContent = COPY_LABEL;
      button.classList.remove('copy--copied', 'copy--failed');
      copyTimers.delete(button);
    }, COPY_FEEDBACK_MS),
  );
}

/**
 * Copies from the field itself rather than from a captured string, so what lands
 * on the clipboard is exactly what the user can see.
 */
async function copyFrom(source: HTMLTextAreaElement, button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(source.value);
    setCopyState(button, '✓ Copied', 'copy--copied');
  } catch {
    // Clipboard access can be refused outright depending on browser and context.
    // Select the text so the keyboard shortcut is one keystroke away.
    source.focus();
    source.select();
    setCopyState(button, 'Press Ctrl+C', 'copy--failed');
  }
}

function createCopyButton(source: HTMLTextAreaElement, label: string): HTMLButtonElement {
  const doc = source.ownerDocument;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = COPY_LABEL;
  // The accessible name stays fixed so it keeps identifying the control while the
  // visible label reports state; the change itself is announced by the
  // aria-live region wrapping the results.
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => {
    void copyFrom(source, button);
  });
  return button;
}

function createReadonlyField(
  doc: Document,
  value: string,
  label: string,
  rows: number,
  className: string,
): HTMLTextAreaElement {
  const field = doc.createElement('textarea');
  field.className = className;
  field.readOnly = true;
  field.rows = rows;
  field.spellcheck = false;
  field.value = value;
  field.setAttribute('aria-label', label);
  return field;
}

function renderShares(target: HTMLElement, shares: readonly string[], threshold: number): void {
  const doc = target.ownerDocument;

  const title = doc.createElement('p');
  title.className = 'result__title';
  title.textContent =
    `${shares.length} shares created. Any ${threshold} of them recover the secret; ` +
    'fewer reveal nothing.';

  const list = doc.createElement('ol');
  list.className = 'shares';

  shares.forEach((share, index) => {
    const position = index + 1;

    const item = doc.createElement('li');
    item.className = 'share';

    const marker = doc.createElement('span');
    marker.className = 'share__index';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = String(position);

    const field = createReadonlyField(doc, share, `Share ${position}`, 2, 'share__value');

    item.append(marker, field, createCopyButton(field, `Copy share ${position}`));
    list.append(item);
  });

  const note = doc.createElement('p');
  note.className = 'result__note';
  note.textContent =
    'Keep each share somewhere different. Reloading this page discards them for good.';

  target.replaceChildren(title, list, note);
}

function renderRecovered(target: HTMLElement, secret: string): void {
  const doc = target.ownerDocument;

  const title = doc.createElement('p');
  title.className = 'result__title result__title--recovered';
  title.textContent = '✓ Secret recovered';

  const field = createReadonlyField(
    doc,
    secret,
    'Recovered secret',
    4,
    'field__control field__control--mono',
  );

  target.replaceChildren(title, field, createCopyButton(field, 'Copy recovered secret'));
}

export function initApp(doc: Document): void {
  const secret = element(doc, 'secret', HTMLTextAreaElement);
  const secretSize = element(doc, 'secret-size', HTMLParagraphElement);
  const shareCount = element(doc, 'share-count', HTMLInputElement);
  const threshold = element(doc, 'threshold', HTMLInputElement);
  const splitForm = element(doc, 'split-form', HTMLFormElement);
  const splitSubmit = element(doc, 'split-submit', HTMLButtonElement);
  const splitError = element(doc, 'split-error', HTMLParagraphElement);
  const splitResult = element(doc, 'split-result', HTMLDivElement);

  const shareInput = element(doc, 'share-input', HTMLTextAreaElement);
  const combineForm = element(doc, 'combine-form', HTMLFormElement);
  const combineSubmit = element(doc, 'combine-submit', HTMLButtonElement);
  const combineError = element(doc, 'combine-error', HTMLParagraphElement);
  const combineResult = element(doc, 'combine-result', HTMLDivElement);

  secret.addEventListener('input', () => {
    const warning = secretSizeWarning(encoder.encode(secret.value).length);
    secretSize.textContent = warning ?? '';
    secretSize.hidden = warning === null;
  });

  // Mirrors the real constraint into the spinner; core still validates for real.
  shareCount.addEventListener('input', () => {
    const requested = Number(shareCount.value);
    threshold.max = Number.isInteger(requested) && requested >= 2 && requested <= 255
      ? String(requested)
      : '255';
  });

  splitForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void (async () => {
      hideError(splitError);
      splitResult.replaceChildren();
      setBusy(splitSubmit, 'Splitting…', true);
      try {
        const requestedThreshold = Number(threshold.value);
        const shares = await splitSecret(secret.value, Number(shareCount.value), requestedThreshold);
        renderShares(splitResult, shares, requestedThreshold);
      } catch (error) {
        showError(splitError, explainError(error));
      } finally {
        setBusy(splitSubmit, 'Split secret', false);
      }
    })();
  });

  combineForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void (async () => {
      hideError(combineError);
      combineResult.replaceChildren();
      setBusy(combineSubmit, 'Recovering…', true);
      try {
        renderRecovered(combineResult, await combineShares(shareInput.value));
      } catch (error) {
        showError(combineError, explainError(error));
      } finally {
        setBusy(combineSubmit, 'Recover secret', false);
      }
    })();
  });
}
