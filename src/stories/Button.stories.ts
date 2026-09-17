import type { Meta, StoryObj } from '@storybook/html-vite';

// Real markup from src/index.html's `.button` (primary action, e.g. "Split secret" /
// "Recover secret") — see design-system.md § "Primary button" for the documented states.
interface ButtonArgs {
  label: string;
  busy: boolean;
  disabled: boolean;
}

function createButton({ label, busy, disabled }: ButtonArgs): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.textContent = busy ? 'Splitting…' : label;
  if (busy) {
    button.setAttribute('aria-busy', 'true');
  }
  button.disabled = disabled;
  return button;
}

const meta: Meta<ButtonArgs> = {
  title: 'Components/Button',
  render: (args) => createButton(args),
  argTypes: {
    label: { control: 'text' },
    busy: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    label: 'Split secret',
    busy: false,
    disabled: false,
  },
};

export default meta;

type Story = StoryObj<ButtonArgs>;

export const Default: Story = {};

// design-system.md: "busy (label swaps to 'Splitting…', aria-busy='true', pointer events off —
// no spinner, the operation is milliseconds)".
export const Busy: Story = {
  args: { busy: true },
};

// design-system.md: "disabled (--color-text-3 bg, cursor: not-allowed, no hover)".
export const Disabled: Story = {
  args: { disabled: true },
};
