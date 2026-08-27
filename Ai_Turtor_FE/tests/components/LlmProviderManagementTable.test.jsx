import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LlmProviderManagementTable from '../../src/features/admin/ai-logs/components/LlmProviderManagementTable';

const provider = {
  providerId: 'groq-1',
  family: 'groq',
  label: 'Groq 1',
  envModel: 'llama-env',
  effectiveModel: 'llama-env',
  envEnabled: true,
  effectiveEnabled: true,
  adminDeleted: false,
  adminEnabledOverride: null,
  adminModelOverride: null,
  apiKeyConfigured: true,
  baseUrl: 'https://api.groq.com/openai/v1',
  timeoutSeconds: 60,
};

const defaultProps = {
  providers: [provider],
  loading: false,
  mutationKey: '',
  onUpdate: vi.fn(),
  onSetEnabled: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
  onReload: vi.fn(),
};

describe('LlmProviderManagementTable', () => {
  it('renders the effective backend state and configuration source', () => {
    render(<LlmProviderManagementTable {...defaultProps} />);

    expect(screen.getByText('Groq 1')).toBeInTheDocument();
    expect(screen.getByText('llama-env')).toBeInTheDocument();
    expect(screen.getByText('Từ biến môi trường')).toBeInTheDocument();
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument();
  });

  it('submits an explicit model override through the edit action', async () => {
    const onUpdate = vi.fn().mockResolvedValue(true);
    render(<LlmProviderManagementTable {...defaultProps} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Groq 1' }));
    fireEvent.click(await screen.findByText('Chỉnh cấu hình'));
    fireEvent.change(screen.getByLabelText('Model override'), { target: { value: 'llama-admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và reload' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('groq-1', {
      enabled: true,
      model: 'llama-admin',
    }));
  });
});
