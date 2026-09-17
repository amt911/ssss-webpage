import type { Meta, StoryObj } from '@storybook/html-vite';

// Real markup shape produced by src/ui/main.ts for each recovered/split share — see
// design-system.md § "Share list item": index + readonly textarea + copy button.
interface ShareArgs {
  index: number;
  value: string;
  copyState: 'idle' | 'copied' | 'failed';
}

function createShareItem({ index, value, copyState }: ShareArgs): HTMLElement {
  const item = document.createElement('li');
  item.className = 'share';

  const indexEl = document.createElement('span');
  indexEl.className = 'share__index';
  indexEl.textContent = String(index);

  const textarea = document.createElement('textarea');
  textarea.className = 'share__value';
  textarea.readOnly = true;
  textarea.rows = 2;
  textarea.value = value;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.setAttribute('aria-label', `Copy share ${index}`);
  if (copyState === 'copied') {
    copyBtn.className = 'copy copy--copied';
    copyBtn.textContent = '✓ Copied';
  } else if (copyState === 'failed') {
    copyBtn.className = 'copy copy--failed';
    copyBtn.textContent = 'Copy failed';
  } else {
    copyBtn.className = 'copy';
    copyBtn.textContent = 'Copy';
  }

  item.append(indexEl, textarea, copyBtn);
  return item;
}

const meta: Meta<ShareArgs> = {
  title: 'Components/ShareListItem',
  // Wrapped in the real `.shares` list so counter-reset/gap styles from styles.css apply
  // exactly like in the built page.
  render: (args) => {
    const list = document.createElement('ul');
    list.className = 'shares';
    list.append(createShareItem(args));
    return list;
  },
  argTypes: {
    index: { control: 'number' },
    value: { control: 'text' },
    copyState: { control: 'radio', options: ['idle', 'copied', 'failed'] },
  },
  args: {
    index: 1,
    value: 'sss1-gK3nQx8pV2mN7xQeLzC5bR1tYw9sHfJ4kD6oU0aZ8iXc9Fw==',
    copyState: 'idle',
  },
};

export default meta;

type Story = StoryObj<ShareArgs>;

export const Default: Story = {};

// design-system.md § "Copy button": "[ Copy ] → [ ✓ Copied ] → [ Copy ] (1.5 s)".
export const Copied: Story = {
  args: { index: 2, copyState: 'copied' },
};

export const CopyFailed: Story = {
  args: { index: 3, copyState: 'failed' },
};
