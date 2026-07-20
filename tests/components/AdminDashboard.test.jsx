import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '../../src/pages/admin/AdminDashboard';
import { diagnosticsApi } from '../../src/services/diagnosticsApi';

vi.mock('../../src/services/diagnosticsApi', () => ({
  diagnosticsApi: {
    getHarnessLogs: vi.fn(),
    getTraceLogs: vi.fn(),
  },
}));

describe('AdminDashboard canonical actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticsApi.getHarnessLogs.mockRejectedValue(new Error('endpoint unavailable'));
  });

  it('uses real navigation actions and never manufactures activity or logs', async () => {
    const onNavigate = vi.fn();
    render(
      <AdminDashboard
        adminStats={{ users: 12, mentors: 3, courses: 4, escalations: 2 }}
        diagnosticsOutput={null}
        isDiagnosticsRunning={false}
        runDiagnostics={vi.fn()}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.queryByText('Weekly Query Activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Chart is being updated...')).not.toBeInTheDocument();
    expect(screen.queryByText('Log service unavailable or endpoint missing.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Quản lý tài khoản và giảng viên/i }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/users');

    await waitFor(() => expect(diagnosticsApi.getHarnessLogs).toHaveBeenCalledTimes(1));
  });
});
