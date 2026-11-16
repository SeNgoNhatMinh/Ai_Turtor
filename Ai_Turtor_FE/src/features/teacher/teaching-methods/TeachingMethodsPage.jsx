import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Button, Card, Input, Modal, Select, Space, Tabs, Tag, message,
} from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import { queryKeys } from '../../../app/queryKeys';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray } from '../../../services/normalizers';
import { teacherApi } from '../../../services/teacherApi';
import { teachingBehaviorApi } from '../../../services/teachingBehaviorApi';
import { tutorSessionApi } from '../../../services/tutorSessionApi';
import { uniqueClassScopes } from '../tutoring/teacherTutoringStudents';
import TeachingBehaviorLibraryPage from '../behaviors/TeachingBehaviorLibraryPage';
import StudentTeachingRagPanel from '../behaviors/StudentTeachingRagPanel';
import {
  CUSTOM_NOTE_CHIPS,
  SUPPORT_LEVEL_CARDS,
  TEACHING_METHODS,
} from './teachingMethodCatalog';
import './TeachingMethods.css';

const { TextArea } = Input;
const EMPTY_LIST = [];

function methodById(id) {
  return TEACHING_METHODS.find((item) => item.id === id);
}

export default function TeachingMethodsPage({ teacherId, triggerToast }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('setup');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedMethods, setSelectedMethods] = useState(['step_by_step', 'examples']);
  const [supportLevel, setSupportLevel] = useState('STANDARD');
  const [customNote, setCustomNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savedSummary, setSavedSummary] = useState(null);
  const [studentId, setStudentId] = useState('');

  const classesQuery = useQuery({
    queryKey: queryKeys.teacherClasses(teacherId),
    queryFn: async ({ signal }) =>
      asArray(await teacherApi.getClassSections(teacherId, { signal }), 'classes', 'classSections', 'content'),
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });

  const scopes = useMemo(
    () => uniqueClassScopes(classesQuery.data || EMPTY_LIST),
    [classesQuery.data],
  );

  const courseOptions = useMemo(() => {
    const seen = new Set();
    return scopes
      .filter((scope) => !seen.has(scope.courseId) && seen.add(scope.courseId))
      .map((scope) => ({ value: scope.courseId, label: scope.courseId }));
  }, [scopes]);

  const classOptions = useMemo(
    () => scopes
      .filter((scope) => scope.courseId === courseId)
      .map((scope) => ({ value: scope.classId, label: scope.label || scope.classId })),
    [scopes, courseId],
  );

  const rosterQuery = useQuery({
    queryKey: queryKeys.teacherClassRoster(teacherId, courseId, classId),
    queryFn: async ({ signal }) =>
      asArray(
        await teacherApi.getClassStudents(courseId, classId, teacherId, { signal }),
        'students',
        'content',
        'items',
      ),
    enabled: Boolean(teacherId && courseId && classId),
  });

  const students = useMemo(() => {
    const rows = rosterQuery.data || EMPTY_LIST;
    return rows.map((row) => ({
      id: row.studentId || row.id,
      name: row.studentName || row.fullName || row.studentId || row.id,
    })).filter((row) => row.id);
  }, [rosterQuery.data]);

  const activityQuery = useQuery({
    queryKey: ['teacher', 'teaching-methods', 'activity', courseId],
    queryFn: ({ signal }) => teachingBehaviorApi.listExecutions({ courseId, size: 30 }, { signal }),
    enabled: Boolean(courseId) && tab === 'activity',
  });

  const toggleMethod = (id) => {
    setDirty(true);
    setSelectedMethods((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const appendChip = (chip) => {
    setDirty(true);
    setCustomNote((current) => (current.includes(chip) ? current : `${current}${current ? ' ' : ''}${chip}`.trim()));
  };

  const saveSettings = async () => {
    if (!courseId || !classId) {
      message.warning('Chọn môn học và lớp trước khi lưu.');
      return;
    }
    if (!selectedMethods.length) {
      message.warning('Chọn ít nhất một phương pháp giảng dạy.');
      return;
    }
    if (selectedMethods.length > 3) {
      message.info('Nên chọn 1–3 phương pháp chính để AI có định hướng rõ.');
    }
    setSaving(true);
    try {
      const created = [];
      for (const methodId of selectedMethods) {
        const method = methodById(methodId);
        if (!method) continue;
        const behavior = await teachingBehaviorApi.create({
          scope: 'COURSE',
          courseId,
          name: method.title,
          strategy: method.strategy,
          instruction: method.instruction,
          supportLevels: [supportLevel],
          description: method.description,
        });
        await teachingBehaviorApi.setStatus(behavior.id, 'APPROVED');
        await teachingBehaviorApi.assign(behavior.id, { courseId, classId: null, studentId: null });
        created.push(behavior.id);
      }
      if (customNote.trim() || supportLevel !== 'STANDARD') {
        const directive = await tutorSessionApi.createDirective(teacherId, {
          courseId,
          classId,
          instruction: customNote.trim() || `Áp dụng mức hỗ trợ ${supportLevel} theo thiết lập Phương pháp giảng dạy AI.`,
          supportLevel,
          priority: 80,
        });
        if (directive?.id) {
          await tutorSessionApi.confirmDirective(teacherId, directive.id);
        }
      }
      setSavedSummary({
        courseId,
        classId,
        methods: selectedMethods.map((id) => methodById(id)?.title).filter(Boolean),
        supportLevel,
        customNote: customNote.trim(),
        behaviorIds: created,
      });
      setDirty(false);
      triggerToast?.('Đã lưu phương pháp giảng dạy AI.');
      queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behaviors'] });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không lưu được thiết lập.'));
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewText('');
    try {
      const methods = selectedMethods.map((id) => methodById(id)).filter(Boolean);
      const sample = [
        'Câu hỏi mẫu: Giải thích Java Method Overloading.',
        '',
        `Mức hỗ trợ: ${SUPPORT_LEVEL_CARDS.find((item) => item.value === supportLevel)?.title || supportLevel}`,
        '',
        'AI sẽ dạy theo các phương pháp:',
        ...methods.map((method, index) => `${index + 1}. ${method.title} — ${method.instruction}`),
        customNote.trim() ? `\nYêu cầu riêng: ${customNote.trim()}` : '',
        '',
        'Đây là bản xem trước chỉ dẫn. Câu trả lời thật vẫn lấy kiến thức từ tài liệu môn học (RAG).',
      ].filter(Boolean).join('\n');
      setPreviewText(sample);
    } finally {
      setPreviewLoading(false);
    }
  };

  const setupTab = (
    <div className="teaching-methods-page">
      {dirty && (
        <Alert type="warning" showIcon message="Bạn có thay đổi chưa lưu" />
      )}
      {savedSummary && (
        <section className="teaching-methods-summary">
          <h3>AI đang hỗ trợ môn {savedSummary.courseId}</h3>
          <p className="teaching-methods-hint">
            Phạm vi: lớp {savedSummary.classId} · Trạng thái: Đang áp dụng
          </p>
          <div>
            <strong>Phương pháp giảng dạy</strong>
            <ul>
              {savedSummary.methods.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
          <p>
            <strong>Mức hỗ trợ mặc định: </strong>
            {SUPPORT_LEVEL_CARDS.find((item) => item.value === savedSummary.supportLevel)?.title}
          </p>
          {savedSummary.customNote && (
            <p><strong>Yêu cầu riêng: </strong>{savedSummary.customNote}</p>
          )}
        </section>
      )}

      <Card title="Phạm vi áp dụng">
        <Space wrap style={{ width: '100%' }}>
          <Select
            style={{ minWidth: 220 }}
            placeholder="Chọn môn học"
            options={courseOptions}
            value={courseId || undefined}
            onChange={(value) => {
              setCourseId(value);
              setClassId('');
              setDirty(true);
            }}
            loading={classesQuery.isFetching}
          />
          <Select
            style={{ minWidth: 180 }}
            placeholder="Chọn lớp"
            options={classOptions}
            value={classId || undefined}
            onChange={(value) => {
              setClassId(value);
              setDirty(true);
            }}
            disabled={!courseId}
            loading={classesQuery.isFetching}
          />
          <Tag>Mặc định: cả môn (có thể chỉnh từng sinh viên ở tab Sinh viên)</Tag>
        </Space>
      </Card>

      <Card title="Cách AI giảng dạy" extra={<span className="teaching-methods-hint">Nên chọn 1–3 phương pháp</span>}>
        <div className="teaching-methods-grid">
          {TEACHING_METHODS.map((method) => (
            <button
              type="button"
              key={method.id}
              className={`teaching-method-card${selectedMethods.includes(method.id) ? ' is-selected' : ''}`}
              onClick={() => toggleMethod(method.id)}
            >
              <strong>{method.title}</strong>
              <span>{method.description}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Mức độ hỗ trợ sinh viên">
        <div className="teaching-support-grid">
          {SUPPORT_LEVEL_CARDS.map((level) => (
            <button
              type="button"
              key={level.value}
              className={`teaching-support-card${supportLevel === level.value ? ' is-selected' : ''}`}
              onClick={() => {
                setSupportLevel(level.value);
                setDirty(true);
              }}
            >
              <strong>{level.title}</strong>
              <span>{level.description}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Yêu cầu riêng cho AI">
        <div className="teaching-methods-chips">
          {CUSTOM_NOTE_CHIPS.map((chip) => (
            <Button key={chip} size="small" onClick={() => appendChip(chip)}>{chip}</Button>
          ))}
        </div>
        <TextArea
          rows={4}
          value={customNote}
          maxLength={800}
          showCount
          placeholder="Ví dụ: Khi giải thích Java, hãy ưu tiên ví dụ thực tế. Không đưa ngay lời giải hoàn chỉnh."
          onChange={(event) => {
            setCustomNote(event.target.value);
            setDirty(true);
          }}
        />
      </Card>

      <div className="teaching-methods-actions">
        <Button onClick={runPreview}>Xem trước cách AI giảng dạy</Button>
        <Button type="primary" loading={saving} onClick={saveSettings}>Lưu thiết lập</Button>
      </div>
    </div>
  );

  const studentsTab = (
    <div className="teaching-methods-page">
      <Alert
        type="info"
        showIcon
        message="Cá nhân hóa theo từng sinh viên"
        description="AI đề xuất cách hỗ trợ từ quá trình học. Bạn luôn quyết định áp dụng hay bỏ qua."
      />
      <Select
        style={{ minWidth: 280 }}
        placeholder="Chọn sinh viên"
        options={students.map((student) => ({ value: student.id, label: student.name }))}
        value={studentId || undefined}
        onChange={setStudentId}
        disabled={!courseId || !classId}
      />
      {studentId && courseId && classId ? (
        <StudentTeachingRagPanel
          studentId={studentId}
          courseId={courseId}
          classId={classId}
          triggerToast={triggerToast}
        />
      ) : (
        <Alert type="info" showIcon message="Chọn môn, lớp và sinh viên để xem hồ sơ và đề xuất." />
      )}
    </div>
  );

  const activityItems = activityQuery.data?.items || [];
  const activityTab = (
    <div className="teaching-methods-page">
      <Card title="Hoạt động của AI">
        {!courseId && <Alert type="info" showIcon message="Chọn môn học để xem hoạt động." />}
        {courseId && activityQuery.isLoading && <p>Đang tải...</p>}
        {courseId && !activityQuery.isLoading && activityItems.length === 0 && (
          <Alert type="info" showIcon message="Chưa có lần áp dụng phương pháp nào được ghi nhận." />
        )}
        <ul>
          {activityItems.slice(0, 30).map((item) => (
            <li key={item.id}>
              {{
                APPLIED: 'Đã dùng',
                SKIPPED: 'Bỏ qua',
                FAILED: 'Lỗi',
                CACHE_HIT: 'Cache',
              }[item.executionStatus] || item.executionStatus}
              {' · '}
              {item.selectedStrategy || item.behaviorId || 'Phương pháp'}
              {item.selectionReason ? ` · ${item.selectionReason}` : ''}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );

  return (
    <div className="teaching-methods-page">
      <PageHeader
        eyebrow="GIẢNG DẠY"
        title="Phương pháp giảng dạy AI"
        description="Thiết lập cách AI hướng dẫn và hỗ trợ sinh viên học tập phù hợp với phương pháp giảng dạy của bạn."
      />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'setup', label: 'Thiết lập', children: setupTab },
          { key: 'students', label: 'Sinh viên', children: studentsTab },
          { key: 'activity', label: 'Hoạt động', children: activityTab },
          {
            key: 'advanced',
            label: 'Nâng cao · Kho hành vi',
            children: <TeachingBehaviorLibraryPage teacherId={teacherId} triggerToast={triggerToast} />,
          },
        ]}
      />
      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        title="Xem trước cách AI giảng dạy"
        footer={[<Button key="close" onClick={() => setPreviewOpen(false)}>Đóng</Button>]}
      >
        {previewLoading ? 'Đang tạo xem trước...' : (
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{previewText}</pre>
        )}
      </Modal>
    </div>
  );
}
