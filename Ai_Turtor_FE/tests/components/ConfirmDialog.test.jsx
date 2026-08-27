import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeActiveConfirm,
  confirmDanger,
} from '../../src/components/common/confirmDialog';

describe('confirm dialog click safety', () => {
  afterEach(() => {
    closeActiveConfirm();
  });

  it('removes an orphaned full-screen portal even when no active dialog is registered', () => {
    const orphan = document.createElement('div');
    orphan.className = 'app-confirm-host';
    document.body.appendChild(orphan);

    closeActiveConfirm();

    expect(document.querySelector('.app-confirm-host')).not.toBeInTheDocument();
  });

  it('uses one stable modal layout even when a caller passes an old anchor', async () => {
    confirmDanger({
      title: 'Delete class?',
      content: 'Confirm this action.',
      anchorRect: {
        top: 120,
        right: 400,
        bottom: 150,
        left: 360,
        width: 40,
        height: 30,
      },
      onOk: vi.fn(),
    });

    await waitFor(() => {
      expect(document.querySelector('.app-confirm-card')).toBeInTheDocument();
    });

    const overlay = document.querySelector('.app-confirm-overlay');
    expect(overlay).not.toHaveClass('app-confirm-overlay--anchored');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
  });
});
