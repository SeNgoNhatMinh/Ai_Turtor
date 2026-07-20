import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeacherMaterialUploadCard from '../../src/features/teacher/materials/TeacherMaterialUploadCard';

const baseProps = {
  courseId: '',
  classId: '',
  classesList: [{
    classCode: 'SE1833',
    name: 'Class SE1833',
    course: 'PRO192',
  }, {
    classCode: 'SE1840',
    name: 'Class SE1840',
    course: 'PRO192',
  }],
  classesLoading: false,
  onClassChange: vi.fn(),
  materialTitle: '',
  setMaterialTitle: vi.fn(),
  materialFile: null,
  setMaterialFile: vi.fn(),
  isUploading: false,
  onUpload: vi.fn((event) => event.preventDefault()),
  onOpenWebsiteImport: vi.fn(),
};

describe('TeacherMaterialUploadCard', () => {
  it('exposes the required class selector and blocks upload without scope', async () => {
    const onClassChange = vi.fn();
    const onUpload = vi.fn((event) => event.preventDefault());
    render(<TeacherMaterialUploadCard {...baseProps} onClassChange={onClassChange} onUpload={onUpload} />);

    const classSelect = screen.getByRole('combobox', { name: 'Lớp học phần' });
    expect(classSelect).toBeVisible();
    const uploadButton = screen.getByRole('button', { name: 'Tải tài liệu' });
    expect(uploadButton).toBeDisabled();
    expect(uploadButton).toHaveAttribute('title', 'Chọn lớp học phần ở trường phía trên.');
    fireEvent.click(uploadButton);
    expect(onUpload).not.toHaveBeenCalled();

    fireEvent.mouseDown(classSelect);
    fireEvent.click(await screen.findByText('Class SE1833 · PRO192'));
    await waitFor(() => expect(onClassChange).toHaveBeenCalledWith('SE1833', expect.anything()));
  });

  it('enables upload when course, class, and PDF are present', () => {
    const materialFile = new File(['pdf'], 'oop.pdf', { type: 'application/pdf' });
    render(
      <TeacherMaterialUploadCard
        {...baseProps}
        courseId="PRO192"
        classId="SE1833"
        materialFile={materialFile}
      />,
    );

    expect(screen.getByText(/PRO192 \/ SE1833/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tải tài liệu' })).toBeEnabled();
  });

  it('clears the native file field when the uploaded file state is reset', () => {
    const materialFile = new File(['pdf'], 'oop.pdf', { type: 'application/pdf' });
    const { rerender } = render(
      <TeacherMaterialUploadCard
        {...baseProps}
        courseId="PRO192"
        classId="SE1833"
        materialFile={materialFile}
      />,
    );
    const fileInput = screen.getByLabelText('Tệp PDF');
    Object.defineProperty(fileInput, 'value', { configurable: true, writable: true, value: 'C:\\fakepath\\oop.pdf' });

    rerender(
      <TeacherMaterialUploadCard
        {...baseProps}
        courseId="PRO192"
        classId="SE1833"
        materialFile={null}
      />,
    );

    expect(fileInput.value).toBe('');
    expect(screen.getByText('Chọn tệp PDF để tải lên.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tải tài liệu' })).toBeDisabled();
  });

  it('automatically resolves the canonical class and course when only one class is assigned', async () => {
    render(
      <TeacherMaterialUploadCard
        {...baseProps}
        classesList={[{
          classId: 'AI101-01',
          classCode: '01',
          className: 'AI101 Lớp 01',
          courseId: 'AI101',
        }]}
      />,
    );

    expect(screen.getByText('Chọn lớp học phần ở trường phía trên.')).toBeVisible();
  });

  it('uses the canonical backend classId when classCode is only a display alias', () => {
    render(
      <TeacherMaterialUploadCard
        {...baseProps}
        courseId="PRO192"
        classId="SE1833"
        classesList={[{
          classId: '1833',
          classCode: 'SE1833',
          className: 'Software Engineering 1833',
          courseId: 'PRO192',
        }]}
      />,
    );

    expect(screen.getByText('Software Engineering 1833 · PRO192')).toBeVisible();
  });

  it('does not display a stale class id that is outside the assigned class list', () => {
    render(<TeacherMaterialUploadCard {...baseProps} classId="OLD-CLASS" courseId="" />);

    expect(screen.getByText('Chọn lớp học phần ở trường phía trên.')).toBeVisible();
    expect(screen.queryByText('OLD-CLASS')).not.toBeInTheDocument();
  });

  it('keeps the backend receipt visible and blocks uploading the same processing file twice', () => {
    const materialFile = new File(['pdf'], 'oop.pdf', { type: 'application/pdf' });
    render(
      <TeacherMaterialUploadCard
        {...baseProps}
        courseId="PRO192"
        classId="SE1833"
        materialFile={materialFile}
        pendingUpload={{
          id: 'material-1',
          title: 'OOP Material',
          fileName: 'oop.pdf',
          status: 'PROCESSING',
        }}
      />,
    );

    expect(screen.getByText('Mã học liệu: material-1')).toBeVisible();
    expect(screen.getByText('Đang xử lý')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tải tài liệu' })).toBeDisabled();
  });
});
