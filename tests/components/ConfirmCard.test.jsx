import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmCard from '../../src/components/common/ConfirmCard';

describe('ConfirmCard', () => {
  it('focuses the safe action and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <ConfirmCard
        title="Delete conversation?"
        content="This action cannot be undone."
        okText="Delete"
        cancelText="Cancel"
        danger
        onClose={onClose}
      />,
    );

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Delete conversation?');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('locks the confirm action until the mutation completes', async () => {
    let resolveAction;
    const onOk = vi.fn(() => new Promise((resolve) => { resolveAction = resolve; }));
    render(
      <ConfirmCard
        title="Confirm action"
        okText="Confirm"
        cancelText="Cancel"
        onOk={onOk}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onOk).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled();
    resolveAction();
  });
});
