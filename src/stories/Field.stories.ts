import type { Meta, StoryObj } from '@storybook/html-vite';

// Real markup from src/index.html's `.field` (label + control + hint) — see
// design-system.md § "Field (label + control + hint + inline error)".
interface FieldArgs {
  label: string;
  hint: string;
  controlType: 'textarea' | 'number';
  value: string;
}

function createField({ label, hint, controlType, value }: FieldArgs): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const id = 'field-demo';
  const hintId = `${id}-hint`;

  const labelEl = document.createElement('label');
  labelEl.className = 'field__label';
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  let control: HTMLElement;
  if (controlType === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.className = 'field__control field__control--mono';
    textarea.rows = 4;
    textarea.spellcheck = false;
    textarea.value = value;
    control = textarea;
  } else {
    const input = document.createElement('input');
    input.className = 'field__control';
    input.type = 'number';
    input.min = '2';
    input.max = '255';
    input.step = '1';
    input.value = value;
    control = input;
  }
  control.id = id;
  control.setAttribute('aria-describedby', hintId);

  const hintEl = document.createElement('p');
  hintEl.className = 'hint';
  hintEl.id = hintId;
  hintEl.textContent = hint;

  wrapper.append(labelEl, control, hintEl);
  return wrapper;
}

const meta: Meta<FieldArgs> = {
  title: 'Components/Field',
  render: (args) => createField(args),
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    controlType: { control: 'radio', options: ['textarea', 'number'] },
    value: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<FieldArgs>;

// The "Secret" field on the split form — mono textarea, per design-system.md.
export const Secret: Story = {
  args: {
    label: 'Secret',
    hint: 'Any text: a passphrase, a recovery key, a few lines of notes.',
    controlType: 'textarea',
    value: '',
  },
};

// The "Number of shares" / "Threshold" fields — numeric input, 2–255.
export const NumberInput: Story = {
  args: {
    label: 'Number of shares',
    hint: 'How many pieces to hand out (2–255).',
    controlType: 'number',
    value: '3',
  },
};
