import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Modal, Segmented, Select } from 'antd';
import { Eye, Pencil, RefreshCw, UserMinus } from 'lucide-react';
import { queryKeys } from '../../../../app/queryKeys';
import { adminAcademicApi } from '../../../../services/adminAcademicApi';
import { getUserFacingError } from '../../../../services/apiClient';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import { DataTable } from '../../../../components/common/DataTable';
import StatusLabel from '../../../../components/common/StatusLabel';
import { getClassCode, getCourseSelectOptions } from '../adminAcademicUtils';
import { getPersonDisplayName, getPersonEmail } from '../../../../utils/displayNames';

const enrollmentActionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'Xem chi tiết' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Chỉnh sửa' },
  { type: 'divider' },
  { key: 'remove', icon: <UserMinus size={14} />, label: 'Xóa khỏi lớp', danger: true },
];

const VIEW_OPTIONS = [
  { value: 'students', label: 'Danh sách sinh viên' },
  { value: 'class', label: 'Theo lớp' },
  { value: 'course', label: 'Theo môn' },
];

const isActiveEnrollment = (item) => {
  const status = String(item?.status || 'ACTIVE').toUpperCase();
  return status !== 'DROPPED' && status !== 'INACTIVE';
};

const getStudentKey = (item) => String(
  item?.studentId || item?.studentEmail || item?.studentCode || item?.id || '',
).trim().toLowerCase();

// One row per student with every course/class they are enrolled in.
const groupByStudent = (enrollments) => {
  const byStudent = new Map();
  enrollments.forEach((item) => {
    const key = getStudentKey(item);
    if (!key) return;
    const current = byStudent.get(key) || {
      id: `student-${key}`,
      studentId: item.studentId,
      studentCode: item.studentCode,
      studentName: item.studentName,
      studentEmail: item.studentEmail,
      enrollments: [],
    };
    current.studentName = current.studentName || item.studentName;
    current.studentEmail = current.studentEmail || item.studentEmail;
    current.studentCode = current.studentCode || item.studentCode;
    current.enrollments.push(item);
    byStudent.set(key, current);
  });
  return Array.from(byStudent.values()).map((student) => {
    const active = student.enrollments.filter(isActiveEnrollment);
    return {
      ...student,
      activeCount: active.length,
      courseSummary: student.enrollments.map((item) => `${item.courseId} ${item.classId}`).join(' '),
    };
  });
};

const nameColumn = {
  accessorKey: 'studentName',
  header: 'Họ tên',
  cell: ({ row }) => <strong>{getPersonDisplayName(row.original, 'Sinh viên')}</strong>,
};

const emailColumn = {
  accessorKey: 'studentEmail',
  header: 'Email',
  cell: ({ row }) => getPersonEmail(row.original) || '—',
};

export default function EnrollmentLookupCard({ courses = [], onAction }) {
  const [view, setView] = useState('students');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [detailStudent, setDetailStudent] = useState(null);
  const courseOptions = getCourseSelectOptions(courses);
  const courseNameById = useMemo(() => new Map(
    (Array.isArray(courses) ? courses : []).map((course) => [course.courseId || course.id, course.courseName]),
  ), [courses]);

  const needsCourse = view !== 'students';
  const needsClass = view === 'class';
  const filterCourseId = needsCourse ? courseId : '';
  const filterClassId = needsClass ? classId : '';
  const ready = (!needsCourse || Boolean(courseId)) && (!needsClass || Boolean(classId));

  const classSectionsQuery = useQuery({
    queryKey: queryKeys.adminClassSections(courseId),
    queryFn: ({ signal }) => adminAcademicApi.getClassSections(courseId, { signal }),
    enabled: needsClass && Boolean(courseId),
    staleTime: 30_000,
  });
  const enrollmentsQuery = useQuery({
    queryKey: queryKeys.adminEnrollments(filterCourseId, filterClassId),
    queryFn: ({ signal }) => adminAcademicApi.getEnrollments(
      { courseId: filterCourseId, classId: filterClassId },
      { signal },
    ),
    enabled: ready,
    staleTime: 15_000,
  });
  const enrollments = useMemo(
    () => (ready && Array.isArray(enrollmentsQuery.data) ? enrollmentsQuery.data : []),
    [enrollmentsQuery.data, ready],
  );
  const students = useMemo(() => groupByStudent(enrollments), [enrollments]);
  const detailRecord = detailStudent
    ? students.find((item) => item.id === detailStudent.id) || { ...detailStudent, enrollments: [] }
    : null;
  const loading = ready && (enrollmentsQuery.isPending || enrollmentsQuery.isFetching);

  const actionColumn = {
    id: 'actions',
    header: '',
    // The row itself opens the detail view; keep menu clicks (including the
    // portalled dropdown, whose events bubble through React) off the row.
    cell: ({ row }) => (
      <span onClick={(event) => event.stopPropagation()}>
        <EntityActionMenu
          items={enrollmentActionItems}
          onAction={(key) => onAction('enrollment', row.original, key)}
          ariaLabel="Thao tác ghi danh"
        />
      </span>
    ),
  };
  const statusColumn = {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => <StatusLabel status={row.getValue('status') || 'ACTIVE'} />,
  };

  const studentColumns = [
    nameColumn,
    emailColumn,
    {
      accessorKey: 'activeCount',
      header: 'Số môn đang học',
      cell: ({ row }) => `${row.original.activeCount}`,
    },
  ];
  const detailColumns = [
    { accessorKey: 'courseId', header: 'Mã môn' },
    {
      accessorKey: 'courseName',
      header: 'Tên môn',
      cell: ({ row }) => row.original.courseName || courseNameById.get(row.original.courseId) || '—',
    },
    { accessorKey: 'classId', header: 'Mã lớp' },
    statusColumn,
    actionColumn,
  ];
  const classColumns = [
    nameColumn,
    emailColumn,
    {
      accessorKey: 'studentCode',
      header: 'Mã SV',
      mobileHidden: true,
      cell: ({ row }) => row.original.studentCode || row.original.studentId || '—',
    },
    statusColumn,
    actionColumn,
  ];
  const courseColumns = [
    nameColumn,
    emailColumn,
    { accessorKey: 'classId', header: 'Mã lớp' },
    statusColumn,
    actionColumn,
  ];

  const emptyText = !ready
    ? (needsClass ? 'Chọn môn học và lớp học phần để xem danh sách sinh viên.' : 'Chọn môn học để xem danh sách sinh viên.')
    : enrollmentsQuery.error
      ? getUserFacingError(enrollmentsQuery.error, 'Không tải được danh sách ghi danh. Vui lòng thử lại.')
      : 'Không có sinh viên nào.';

  return (
    <Card
      title="Tra cứu sinh viên"
      hoverable
      extra={(
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => enrollmentsQuery.refetch()}
          disabled={!ready}
          loading={enrollmentsQuery.isFetching}
        >
          Tải lại
        </Button>
      )}
    >
      <Segmented
        block
        options={VIEW_OPTIONS}
        value={view}
        onChange={setView}
        className="admin-enrollment-view-switch"
      />
      {needsCourse && (
        <div className="admin-enrollment-filters">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn môn học"
            value={courseId || undefined}
            options={courseOptions}
            onChange={(value) => {
              setCourseId(value || '');
              setClassId('');
            }}
          />
          {needsClass && (
            <Select
              showSearch
              placeholder="Chọn lớp học phần"
              value={classId || undefined}
              disabled={!courseId}
              loading={classSectionsQuery.isFetching}
              options={(classSectionsQuery.data || [])
                .map((section) => getClassCode(section))
                .filter(Boolean)
                .map((code) => ({ value: code, label: code }))}
              onChange={(value) => setClassId(value || '')}
            />
          )}
        </div>
      )}
      {view === 'students' ? (
        <div className="admin-enrollment-students-table">
          <DataTable
            key="students"
            data={students}
            loading={loading}
            pageSize={10}
            maxBodyHeight={560}
            searchKeys={['studentName', 'studentEmail', 'studentCode', 'studentId', 'courseSummary']}
            searchPlaceholder="Tìm theo họ tên, email, mã môn hoặc lớp"
            emptyText={emptyText}
            columns={studentColumns}
            onRowClick={setDetailStudent}
            rowAriaLabel={(record) => `Xem môn đang học của ${getPersonDisplayName(record, 'sinh viên')}`}
          />
        </div>
      ) : (
        <DataTable
          key={view}
          data={enrollments}
          loading={loading}
          pageSize={10}
          maxBodyHeight={560}
          searchKeys={['studentName', 'studentEmail', 'studentCode', 'studentId', 'classId']}
          searchPlaceholder="Tìm theo họ tên, email hoặc mã SV"
          emptyText={emptyText}
          columns={view === 'class' ? classColumns : courseColumns}
          onRowClick={(record) => onAction('enrollment', record, 'view')}
          rowAriaLabel={(record) => `Xem chi tiết ghi danh của ${getPersonDisplayName(record, 'sinh viên')}`}
        />
      )}
      <Modal
        open={Boolean(detailRecord)}
        onCancel={() => setDetailStudent(null)}
        footer={null}
        width={760}
        title={detailRecord
          ? `${getPersonDisplayName(detailRecord, 'Sinh viên')}${getPersonEmail(detailRecord) ? ` · ${getPersonEmail(detailRecord)}` : ''}`
          : ''}
        destroyOnHidden
      >
        <DataTable
          data={detailRecord?.enrollments || []}
          pageSize={10}
          searchable={false}
          maxBodyHeight={480}
          emptyText="Sinh viên chưa ghi danh môn nào."
          columns={detailColumns}
        />
      </Modal>
    </Card>
  );
}
