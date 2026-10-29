import { describe, expect, it } from 'vitest';
import { groupByStudent } from '../../src/features/admin/academic/components/enrollmentLookupUtils';

describe('groupByStudent', () => {
  it('merges UUID and imported student-code rows that share an email', () => {
    const grouped = groupByStudent([
      {
        studentId: '7bd7d121-b1b4-4b47-b077-a1d617a98219',
        studentName: 'Nhật Minh',
        studentEmail: 'se185018ngonhatminh@gmail.com',
        courseId: 'CEA201',
        classId: 'CEA201-01',
        status: 'ACTIVE',
      },
      {
        studentId: 'SE083418',
        studentName: 'Suất Xắc',
        studentEmail: 'se185018ngonhatminh@gmail.com',
        courseId: 'PRO192',
        classId: 'SE1832',
        status: 'ACTIVE',
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].studentEmail).toBe('se185018ngonhatminh@gmail.com');
    expect(grouped[0].activeCount).toBe(2);
    expect(grouped[0].studentId).toBe('7bd7d121-b1b4-4b47-b077-a1d617a98219');
  });
});
