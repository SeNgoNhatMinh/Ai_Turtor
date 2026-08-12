import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImportWebsiteModal from '../../src/components/importWebsite/ImportWebsiteModal';

describe('ImportWebsiteModal', () => {
  it('requires Admin to analyze and select backend TOC items before importing', async () => {
    const materialApi = {
      previewMaterialUrlToc: vi.fn().mockResolvedValue({
        title: 'Java Virtual Machine Specification',
        sourceUrl: 'https://docs.example.com/index.html',
        itemCount: 1,
        items: [{
          title: 'Chương 1 - Giới thiệu',
          url: 'https://docs.example.com/chapter-1.html',
          level: 1,
        }],
      }),
      importCourseMaterialUrl: vi.fn().mockResolvedValue({
        materialId: 'material-1',
        title: 'JVM Specification',
      }),
    };
    const onClose = vi.fn();

    render(
      <ImportWebsiteModal
        open
        onClose={onClose}
        courseId="PRO192"
        currentUser={{ id: 'admin-1' }}
        materialApi={materialApi}
        triggerToast={vi.fn()}
        onUploaded={vi.fn()}
        isAdmin
      />,
    );

    expect(screen.getByRole('button', { name: /Import URL/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('URL tài liệu'), {
      target: { value: 'https://docs.example.com/index.html' },
    });
    fireEvent.change(screen.getByLabelText('Tên học liệu'), {
      target: { value: 'JVM Specification' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Phân tích URL/ }));

    await waitFor(() => expect(materialApi.previewMaterialUrlToc).toHaveBeenCalledWith(
      'PRO192',
      { url: 'https://docs.example.com/index.html' },
    ));

    fireEvent.click(await screen.findByText('Chương 1 - Giới thiệu'));
    fireEvent.click(screen.getByRole('button', { name: /Import mục đã chọn/ }));

    await waitFor(() => expect(materialApi.importCourseMaterialUrl).toHaveBeenCalledWith(
      'PRO192',
      expect.objectContaining({
        uploaderRole: 'ADMIN',
        teacherId: 'admin-1',
        selectedUrls: ['https://docs.example.com/chapter-1.html'],
      }),
    ));
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  it('selects and imports every TOC item without a fixed 50-item cap', async () => {
    const items = Array.from({ length: 169 }, (_, index) => ({
      title: `Mục ${index + 1}`,
      url: `https://docs.example.com/chapter.html#section-${index + 1}`,
      level: 2,
    }));
    const materialApi = {
      previewMaterialUrlToc: vi.fn().mockResolvedValue({
        title: 'The Java Virtual Machine Specification',
        sourceUrl: 'https://docs.example.com/index.html',
        itemCount: items.length,
        items,
      }),
      importCourseMaterialUrl: vi.fn().mockResolvedValue({
        materialId: 'material-all',
        title: 'JVM Specification',
      }),
    };

    render(
      <ImportWebsiteModal
        open
        onClose={vi.fn()}
        courseId="OOP"
        currentUser={{ id: 'admin-1' }}
        materialApi={materialApi}
        triggerToast={vi.fn()}
        onUploaded={vi.fn()}
        isAdmin
      />,
    );

    fireEvent.change(screen.getByLabelText('URL tài liệu'), {
      target: { value: 'https://docs.example.com/index.html' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Phân tích URL/ }));
    await screen.findByText('Mục 169');

    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả 169 mục đang hiển thị' }));
    expect(screen.getByText('Đã chọn 169 mục')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Import mục đã chọn \(169\)/ }));

    await waitFor(() => expect(materialApi.importCourseMaterialUrl).toHaveBeenCalledWith(
      'OOP',
      expect.objectContaining({ selectedUrls: expect.arrayContaining(items.map((item) => item.url)) }),
    ));
    expect(materialApi.importCourseMaterialUrl.mock.calls[0][1].selectedUrls).toHaveLength(169);
  }, 15000);
});
