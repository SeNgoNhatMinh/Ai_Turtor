import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CurriculumGuideTab from '../../src/features/admin/academic/components/CurriculumGuideTab';
import { adminAcademicApi } from '../../src/services/adminAcademicApi';

vi.mock('../../src/services/adminAcademicApi', () => ({
  adminAcademicApi: {
    getLearningGuide: vi.fn(),
    getStudentLearningGuide: vi.fn(),
    updateLearningGuide: vi.fn(),
    regenerateLearningGuide: vi.fn(),
    approveLearningGuide: vi.fn(),
    rejectLearningGuide: vi.fn(),
  },
}));

const courses = [{ courseId: 'PRO192', courseName: 'Object-Oriented Programming' }];

const guide = {
  status: 'PENDING_REVIEW',
  syllabusVersion: 'a143ad008a42',
  overview: 'Môn học giới thiệu lập trình hướng đối tượng.',
  knowledgeObjectives: ['Hiểu đóng gói và kế thừa'],
  skillObjectives: ['Viết được chương trình Java cơ bản'],
  topics: [{ title: 'Theo dõi quá trình', detail: 'Thực thi logic chương trình Java' }],
  keywords: ['Theo dõi quá trình'],
  validationWarnings: [],
};

const studentView = {
  overview: guide.overview,
  knowledgeObjectives: guide.knowledgeObjectives,
  skillObjectives: guide.skillObjectives,
  topics: guide.topics,
  keywords: ['Theo dõi quá trình'],
};

describe('CurriculumGuideTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminAcademicApi.getLearningGuide.mockResolvedValue(guide);
    adminAcademicApi.getStudentLearningGuide.mockResolvedValue(studentView);
    adminAcademicApi.updateLearningGuide.mockResolvedValue({ ...guide, status: 'APPROVED' });
  });

  it('loads the guide into the editor and shows the student preview', async () => {
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    expect(await screen.findByDisplayValue('Theo dõi quá trình')).toBeTruthy();
    expect(screen.getByDisplayValue('Hiểu đóng gói và kế thừa')).toBeTruthy();
    expect(screen.getByText(/Sinh viên đang thấy/)).toBeTruthy();
    expect(screen.getByText('Chờ duyệt · sinh viên thấy bản parse từ syllabus')).toBeTruthy();
  });

  it('shows exactly what students see in every editor field', async () => {
    adminAcademicApi.getLearningGuide.mockResolvedValue({
      ...guide,
      topics: [{ title: 'Bản trích xuất admin chưa công khai', detail: '' }],
      knowledgeObjectives: ['Mục tiêu chỉ admin thấy'],
    });
    adminAcademicApi.getStudentLearningGuide.mockResolvedValue(studentView);
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    expect(await screen.findByDisplayValue('Theo dõi quá trình')).toBeTruthy();
    expect(screen.queryByDisplayValue('Bản trích xuất admin chưa công khai')).toBeNull();
    expect(screen.queryByDisplayValue('Mục tiêu chỉ admin thấy')).toBeNull();
    expect(screen.getByDisplayValue('Hiểu đóng gói và kế thừa')).toBeTruthy();
  });

  it('prefills the overview editor from the student view when the stored guide has none', async () => {
    adminAcademicApi.getLearningGuide.mockResolvedValue({ ...guide, overview: '' });
    adminAcademicApi.getStudentLearningGuide.mockResolvedValue({
      ...studentView,
      overview: 'Servlet and JSP; MVC architecture',
    });
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    await screen.findByDisplayValue('Theo dõi quá trình');
    expect(screen.getByLabelText('Tóm tắt môn học').value).toBe('Servlet and JSP; MVC architecture');
  });

  it('parses a pasted full template into the editor fields', async () => {
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    await screen.findByDisplayValue('Theo dõi quá trình');
    fireEvent.click(screen.getByRole('button', { name: 'Nạp Curriculum Guide' }));
    fireEvent.change(screen.getByLabelText('Nội dung Curriculum Guide'), {
      target: {
        value: [
          'TÓM TẮT MÔN HỌC:',
          'Môn học về lập trình Python cơ bản.',
          '',
          'MỤC TIÊU KIẾN THỨC:',
          '- Hiểu cú pháp Python',
          '- Hiểu biến và kiểu dữ liệu',
          '',
          'MỤC TIÊU KỸ NĂNG:',
          '- Viết chương trình Python đơn giản',
          '',
          'CHƯƠNG / CHỦ ĐỀ:',
          '1. Cú pháp Python: Biến và kiểu dữ liệu',
          '2. Cấu trúc điều khiển: if/else và vòng lặp',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nạp' }));

    expect(screen.getByLabelText('Tóm tắt môn học').value).toBe('Môn học về lập trình Python cơ bản.');
    expect(screen.getByLabelText('Mục tiêu kiến thức').value).toBe('Hiểu cú pháp Python\nHiểu biến và kiểu dữ liệu');
    expect(screen.getByLabelText('Mục tiêu kỹ năng').value).toBe('Viết chương trình Python đơn giản');
    expect(screen.getByDisplayValue('Cú pháp Python')).toBeTruthy();
    expect(screen.getByDisplayValue('Biến và kiểu dữ liệu')).toBeTruthy();
    expect(screen.getByDisplayValue('Cấu trúc điều khiển')).toBeTruthy();
  });

  it('loads the full template skeleton into the paste box', async () => {
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    await screen.findByDisplayValue('Theo dõi quá trình');
    fireEvent.click(screen.getByRole('button', { name: 'Nạp Curriculum Guide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mẫu trống' }));

    expect(screen.getByLabelText('Nội dung Curriculum Guide').value).toContain('CHƯƠNG / CHỦ ĐỀ:');
  });

  it('copies the full template to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    await screen.findByDisplayValue('Theo dõi quá trình');
    fireEvent.click(screen.getByRole('button', { name: 'Nạp Curriculum Guide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mẫu' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('MỤC TIÊU KIẾN THỨC:');
  });

  it('saves edited content as the student-facing curriculum', async () => {
    render(<CurriculumGuideTab courses={courses} triggerToast={vi.fn()} />);

    const titleInput = await screen.findByDisplayValue('Theo dõi quá trình');
    fireEvent.change(titleInput, { target: { value: 'Vòng đời luồng Java' } });
    // The student preview follows the editor in real time (topic + keyword).
    expect(screen.getAllByText('Vòng đời luồng Java').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole('button', { name: /Lưu & công khai/ }));

    await waitFor(() => expect(adminAcademicApi.updateLearningGuide).toHaveBeenCalledTimes(1));
    const [courseId, payload] = adminAcademicApi.updateLearningGuide.mock.calls[0];
    expect(courseId).toBe('PRO192');
    expect(payload.topics).toEqual([
      { title: 'Vòng đời luồng Java', detail: 'Thực thi logic chương trình Java' },
    ]);
    expect(payload.knowledgeObjectives).toEqual(['Hiểu đóng gói và kế thừa']);
    // Keywords are never sent by the client; the server derives them from topics.
    expect(payload.keywords).toBeUndefined();
  });
});
