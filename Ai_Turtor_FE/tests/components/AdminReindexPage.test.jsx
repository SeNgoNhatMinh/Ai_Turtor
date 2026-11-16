import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminReindexPage from '../../src/features/admin/reindex/AdminReindexPage';
import { materialsApi } from '../../src/services/materialsApi';

vi.mock('../../src/services/adminAcademicApi', () => ({
  adminAcademicApi: {
    getCourses: vi.fn(async () => [{ courseId: 'PRJ301', courseName: 'Java Web' }]),
  },
}));

vi.mock('../../src/services/materialsApi', () => ({
  materialsApi: {
    currentReindexRun: vi.fn(async () => ({ status: 'IDLE', courses: [] })),
    startReindexRun: vi.fn(),
    stopReindexRun: vi.fn(),
  },
}));

const runningSnapshot = {
  status: 'RUNNING',
  courses: [{
    courseId: 'PRJ301',
    status: 'PROCESSING',
    percent: 46,
    stageLabel: 'Đang tạo embedding',
    message: 'Tài liệu 1/2 · Chương 4 · Đang tạo embedding · 40/100 đoạn',
  }],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminReindexPage />
    </QueryClientProvider>,
  );
}

describe('admin reindex progress', () => {
  it('shows server progress again after the page is opened', async () => {
    materialsApi.currentReindexRun.mockResolvedValue(runningSnapshot);
    renderPage();

    expect(await screen.findByText('Đang tạo embedding')).toBeVisible();
    expect(screen.getByText('PRJ301 · Tài liệu 1/2 · Chương 4 · Đang tạo embedding · 40/100 đoạn')).toBeVisible();
    expect(screen.getAllByText('46%').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Dừng' }).length).toBeGreaterThan(0);
  });

  it('asks the backend to stop the running reindex', async () => {
    materialsApi.currentReindexRun.mockResolvedValue(runningSnapshot);
    materialsApi.stopReindexRun.mockResolvedValue({ ...runningSnapshot, status: 'STOPPING' });
    renderPage();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Dừng' }))[0]);

    expect(materialsApi.stopReindexRun).toHaveBeenCalledTimes(1);
  });
});
