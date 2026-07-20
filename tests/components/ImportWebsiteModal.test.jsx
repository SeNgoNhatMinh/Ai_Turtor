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

    fireEvent.click(await screen.findByRole('checkbox', { name: /Chương 1 - Giới thiệu/ }));
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
  });
});
