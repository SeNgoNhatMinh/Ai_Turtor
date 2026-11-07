import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Form, Input, Modal, Select, Skeleton, Tag } from 'antd';
import { queryKeys } from '../../../app/queryKeys';
import { getUserFacingError } from '../../../services/apiClient';
import { teachingBehaviorApi } from '../../../services/teachingBehaviorApi';
import {
  BEHAVIOR_DOMAINS,
  BEHAVIOR_STATUS_COLORS,
  BEHAVIOR_STATUS_LABELS,
  MAX_BEHAVIOR_LENGTH,
  SUPPORT_LEVEL_OPTIONS,
} from './behaviorConstants';
import { BehaviorScopeTag, BehaviorStats } from './BehaviorTags';
import './TeachingBehaviors.css';

const EMPTY_LIST = [];
const AI_ACTOR = 'AI_TUTOR';
const PACE_OPTIONS = [
  { value: '', label: 'Chưa xác định' },
  { value: 'SLOW', label: 'Chậm, cần từng bước nhỏ' },
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'FAST', label: 'Nhanh, thích thử thách' },
];
const REASON_LABELS = {
  PINNED: 'Giảng viên ghim',
  STUDENT: 'Hành vi riêng',
  COURSE: 'Kho theo môn',
  DOMAIN: 'Kho theo domain',
  GLOBAL: 'Kho toàn hệ thống',
};
const STATUS_RANK = { AI_PENDING: 0, APPROVED: 1, RETIRED: 2, REJECTED: 3 };

function profileForm(profile) {
  return {
    learnsBestWith: profile?.learnsBestWith || [],
    struggleSignals: profile?.struggleSignals || [],
    pace: profile?.pace || '',
    teacherNote: profile?.teacherNote || '',
  };
}

function isAiCreated(behavior) {
  return behavior?.createdBy === AI_ACTOR
    || String(behavior?.createdByName || '').toLowerCase().includes('ai tutor');
}

function sortPersonal(items) {
  return [...items].sort((left, right) => {
    const byStatus = (STATUS_RANK[left.status] ?? 9) - (STATUS_RANK[right.status] ?? 9);
    if (byStatus !== 0) return byStatus;
    return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
  });
}

function TagInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <Select mode="tags" value={value} onChange={onChange} tokenSeparators={[';']} open={false}
      placeholder={placeholder} aria-label={ariaLabel} maxCount={8} />
  );
}

function PersonalBehaviorModal({ open, editing, onClose, onSubmit, saving }) {
  const formKey = editing?.id || 'new';
  const initialValues = editing
    ? { instruction: editing.instruction, supportLevels: editing.supportLevels || [] }
    : { instruction: '', supportLevels: [] };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      title={editing ? 'Sửa hành vi riêng' : 'Thêm hành vi riêng'}
    >
      <Form
        key={formKey}
        layout="vertical"
        requiredMark={false}
        className="teaching-behavior-form"
        initialValues={initialValues}
        onFinish={async (values) => {
          await onSubmit({
            instruction: values.instruction,
            supportLevels: values.supportLevels || [],
          });
        }}
      >
        <Form.Item
          name="instruction"
          label="Cách giảng (AI sẽ làm theo với sinh viên này)"
          rules={[{ required: true, whitespace: true, message: 'Nhập cách giảng' }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={MAX_BEHAVIOR_LENGTH}
            showCount
            placeholder="Ví dụ: Luôn so sánh với ví dụ đời thường trước khi đưa code"
          />
        </Form.Item>
        <Form.Item name="supportLevels" label="Áp dụng cho mức hỗ trợ" extra="Để trống = mọi mức.">
          <Select mode="multiple" allowClear options={SUPPORT_LEVEL_OPTIONS} placeholder="Mọi mức" />
        </Form.Item>
        {editing?.status === 'AI_PENDING' && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Đây là chiến lược AI vừa tự thêm. Lưu sẽ duyệt và giữ lại cho sinh viên."
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? 'Lưu' : 'Thêm'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

/**
 * One student's own RAG behavior set for a course: AI auto-adds personal
 * behaviors after each learning review; the teacher CRUD-manages them here.
 */
export default function StudentTeachingRagPanel({ studentId, courseId, classId, triggerToast }) {
  const queryClient = useQueryClient();
  const enabled = Boolean(studentId && courseId && classId);
  const ragKey = queryKeys.studentTeachingRag(studentId, courseId, classId);
  const ragQuery = useQuery({
    queryKey: ragKey,
    queryFn: ({ signal }) => teachingBehaviorApi.getStudentBehaviors(studentId, courseId, classId, { signal }),
    enabled,
    staleTime: 15_000,
  });
  const data = ragQuery.data;
  const profile = data?.profile;
  const personal = useMemo(
    () => sortPersonal((data?.personal ?? EMPTY_LIST).filter((item) => item.status !== 'REJECTED')),
    [data?.personal],
  );
  const pendingCount = personal.filter((item) => item.status === 'AI_PENDING').length;
  const pinned = data?.pinned ?? EMPTY_LIST;
  const blocked = data?.blocked ?? EMPTY_LIST;
  const pinnedIds = useMemo(() => new Set(pinned.map((item) => item.id)), [pinned]);
  const blockedIds = useMemo(() => new Set(blocked.map((item) => item.id)), [blocked]);

  const [form, setForm] = useState(() => profileForm(null));
  const [savingProfile, setSavingProfile] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [modal, setModal] = useState({ open: false, editing: null });
  const [savingBehavior, setSavingBehavior] = useState(false);
  const [libraryKeyword, setLibraryKeyword] = useState('');
  const [preview, setPreview] = useState({ question: '', domain: '', result: null, loading: false });

  const profileKey = `${studentId}:${courseId}:${profile?.updatedAt || profile?.id || ''}`;
  const [formKey, setFormKey] = useState('');
  if (data && profileKey !== formKey) {
    setFormKey(profileKey);
    setForm(profileForm(profile));
  }

  const libraryQuery = useQuery({
    queryKey: queryKeys.teachingBehaviors({ status: 'APPROVED', q: libraryKeyword, picker: true }),
    queryFn: ({ signal }) => teachingBehaviorApi.list({ status: 'APPROVED', q: libraryKeyword, size: 30 }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const libraryOptions = (libraryQuery.data?.items ?? EMPTY_LIST)
    .filter((item) => item.scope !== 'STUDENT' && !pinnedIds.has(item.id) && !blockedIds.has(item.id))
    .filter((item) => item.scope !== 'COURSE' || item.courseId === courseId)
    .map((item) => ({ value: item.id, label: item.instruction }));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ragKey });

  const run = async (key, action, success) => {
    setBusyKey(key);
    try {
      await action();
      if (success) triggerToast?.(success);
      await refresh();
      return true;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thực hiện được thao tác.'));
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const change = (behaviorId, action, success) => run(`${action}-${behaviorId}`,
    () => teachingBehaviorApi.changeStudentBehavior(studentId, courseId, classId, behaviorId, action), success);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await teachingBehaviorApi.updateStudentProfile(studentId, courseId, classId, {
        ...form,
        pace: form.pace || null,
      });
      triggerToast?.('Đã lưu hồ sơ học của sinh viên.');
      await refresh();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không lưu được hồ sơ học.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePersonal = async (values) => {
    setSavingBehavior(true);
    try {
      if (modal.editing) {
        await teachingBehaviorApi.updateStudentBehavior(
          studentId, courseId, classId, modal.editing.id, values);
        triggerToast?.(modal.editing.status === 'AI_PENDING'
          ? 'Đã duyệt và cập nhật hành vi AI đề xuất.'
          : 'Đã cập nhật hành vi riêng.');
      } else {
        await teachingBehaviorApi.createStudentBehavior(studentId, courseId, classId, values);
        triggerToast?.('Đã thêm hành vi riêng cho sinh viên.');
      }
      setModal({ open: false, editing: null });
      await refresh();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không lưu được hành vi riêng.'));
    } finally {
      setSavingBehavior(false);
    }
  };

  const approvePending = (behavior) => run(`approve-${behavior.id}`,
    () => teachingBehaviorApi.setStudentBehaviorStatus(studentId, courseId, classId, behavior.id, 'APPROVED'),
    'Đã duyệt hành vi AI đề xuất.');

  const toggleStatus = (behavior) => {
    const next = behavior.status === 'RETIRED' ? 'APPROVED' : 'RETIRED';
    return run(`status-${behavior.id}`,
      () => teachingBehaviorApi.setStudentBehaviorStatus(studentId, courseId, classId, behavior.id, next),
      next === 'RETIRED' ? 'Đã tắt hành vi (AI không dùng nữa).' : 'Đã bật lại hành vi.');
  };

  const runPreview = async () => {
    setPreview((current) => ({ ...current, loading: true }));
    try {
      const result = await teachingBehaviorApi.previewStudent(
        studentId, courseId, classId, preview.question.trim(), preview.domain);
      setPreview((current) => ({ ...current, result, loading: false }));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không xem trước được.'));
      setPreview((current) => ({ ...current, loading: false }));
    }
  };

  if (!enabled) {
    return <Alert type="info" showIcon message="Chọn lớp của sinh viên để xem bộ RAG behavior riêng." />;
  }
  if (ragQuery.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (ragQuery.isError) {
    return <Alert type="error" showIcon message="Không tải được bộ RAG behavior"
      description={getUserFacingError(ragQuery.error, 'Thử lại sau ít phút.')} />;
  }

  const renderItem = (behavior, actions) => (
    <li key={behavior.id}
      className={`student-rag-item${['RETIRED', 'REJECTED'].includes(behavior.status) ? ' is-muted' : ''}${behavior.status === 'AI_PENDING' ? ' is-pending' : ''}`}>
      <p>{behavior.instruction}</p>
      <div className="student-rag-item__meta">
        <BehaviorScopeTag behavior={behavior} />
        <Tag color={BEHAVIOR_STATUS_COLORS[behavior.status]}>{BEHAVIOR_STATUS_LABELS[behavior.status] || behavior.status}</Tag>
        {isAiCreated(behavior) && <Tag color="purple">AI tự thêm</Tag>}
        {pinnedIds.has(behavior.id) && <Tag color="geekblue">Đã ghim</Tag>}
        {blockedIds.has(behavior.id) && <Tag color="red">Đã chặn</Tag>}
        <BehaviorStats behavior={behavior} />
      </div>
      <div className="student-rag-item__actions">{actions}</div>
    </li>
  );

  return (
    <div className="student-rag-panel">
      <Alert
        type="info"
        showIcon
        className="student-rag-panel__notice"
        message="Phong cách diễn giải riêng theo từng sinh viên · từng môn"
        description="Sau mỗi đánh giá, AI tự đổi phong cách câu trả lời của sinh viên này và đánh số các tiêu đề. Bạn vẫn sửa, tắt hoặc từ chối. Sáu phong cách: giải thích khái niệm, ví dụ thực tế, minh họa trực quan, bảng so sánh, bài tập có hướng dẫn, tự kiểm tra."
      />

      <section className="student-rag-card">
        <h5>Hồ sơ học của sinh viên</h5>
        <p className="student-rag-card__hint">AI tự cập nhật sau mỗi đánh giá tiến bộ; bạn có thể sửa trực tiếp.</p>
        <div className="student-rag-profile">
          <label>Học tốt nhất với
            <TagInput value={form.learnsBestWith} ariaLabel="Học tốt nhất với"
              onChange={(learnsBestWith) => setForm((current) => ({ ...current, learnsBestWith }))}
              placeholder="ví dụ đời thường; sơ đồ; code mẫu ngắn" />
          </label>
          <label>Dấu hiệu hay vấp
            <TagInput value={form.struggleSignals} ariaLabel="Dấu hiệu hay vấp"
              onChange={(struggleSignals) => setForm((current) => ({ ...current, struggleSignals }))}
              placeholder="nhầm overload và override" />
          </label>
          <label>Nhịp độ
            <Select value={form.pace} options={PACE_OPTIONS} aria-label="Nhịp độ"
              onChange={(pace) => setForm((current) => ({ ...current, pace }))} />
          </label>
          <label className="student-rag-profile__wide">Ghi chú của giảng viên
            <Input.TextArea rows={2} maxLength={500} showCount value={form.teacherNote} aria-label="Ghi chú của giảng viên"
              onChange={(event) => setForm((current) => ({ ...current, teacherNote: event.target.value }))}
              placeholder="Ví dụ: Sinh viên ngại hỏi, nên khen khi làm đúng" />
          </label>
        </div>
        <Button type="primary" onClick={saveProfile} loading={savingProfile}>Lưu hồ sơ học</Button>
      </section>

      <section className="student-rag-card">
        <div className="student-rag-card__title-row">
          <div>
            <h5>Hành vi riêng · {courseId} ({personal.length})</h5>
            <p className="student-rag-card__hint">
              {pendingCount > 0
                ? `${pendingCount} hành vi AI vừa tự thêm đang được áp dụng và chờ bạn duyệt/sửa.`
                : 'CRUD bộ cách giảng riêng của sinh viên này trong môn hiện tại.'}
            </p>
          </div>
          <Button type="primary" onClick={() => setModal({ open: true, editing: null })}>Thêm hành vi</Button>
        </div>

        {personal.length ? (
          <ul className="student-rag-list">
            {personal.map((behavior) => renderItem(behavior, (
              <>
                {behavior.status === 'AI_PENDING' && (
                  <Button size="small" type="primary" loading={busyKey === `approve-${behavior.id}`}
                    onClick={() => approvePending(behavior)}>
                    Duyệt
                  </Button>
                )}
                <Button size="small" onClick={() => setModal({ open: true, editing: behavior })}>
                  Sửa
                </Button>
                {pinnedIds.has(behavior.id)
                  ? <Button size="small" loading={busyKey === `unpin-${behavior.id}`}
                    onClick={() => change(behavior.id, 'unpin', 'Đã bỏ ghim.')}>Bỏ ghim</Button>
                  : <Button size="small" loading={busyKey === `pin-${behavior.id}`}
                    disabled={behavior.status === 'RETIRED'}
                    onClick={() => change(behavior.id, 'pin', 'AI sẽ luôn dùng hành vi này.')}>Ghim</Button>}
                <Button size="small" danger={behavior.status !== 'RETIRED'} loading={busyKey === `status-${behavior.id}`}
                  onClick={() => toggleStatus(behavior)}>
                  {behavior.status === 'RETIRED' ? 'Bật lại' : 'Tắt'}
                </Button>
              </>
            )))}
          </ul>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có hành vi riêng. AI sẽ tự thêm sau đánh giá tiến bộ, hoặc bạn thêm tay."
          />
        )}
      </section>

      <section className="student-rag-card">
        <h5>Từ kho dùng chung</h5>
        <p className="student-rag-card__hint">Ghim để AI luôn áp dụng cho sinh viên này; chặn để AI không bao giờ dùng.</p>
        <Select showSearch filterOption={false} value={null} placeholder="Tìm hành vi trong kho để ghim"
          onSearch={setLibraryKeyword} loading={libraryQuery.isFetching} options={libraryOptions}
          aria-label="Ghim từ kho"
          notFoundContent={libraryQuery.isFetching ? 'Đang tìm...' : 'Không có hành vi phù hợp'}
          onSelect={(behaviorId) => change(behaviorId, 'pin', 'Đã ghim hành vi cho sinh viên.')} />
        {pinned.filter((item) => item.scope !== 'STUDENT').length > 0 && (
          <ul className="student-rag-list">
            {pinned.filter((item) => item.scope !== 'STUDENT').map((behavior) => renderItem(behavior, (
              <>
                <Button size="small" loading={busyKey === `unpin-${behavior.id}`}
                  onClick={() => change(behavior.id, 'unpin', 'Đã bỏ ghim.')}>Bỏ ghim</Button>
                <Button size="small" danger loading={busyKey === `block-${behavior.id}`}
                  onClick={() => change(behavior.id, 'block', 'AI sẽ không dùng hành vi này cho sinh viên.')}>Chặn</Button>
              </>
            )))}
          </ul>
        )}
        {blocked.length > 0 && (
          <>
            <strong>Đã chặn cho sinh viên này</strong>
            <ul className="student-rag-list">
              {blocked.map((behavior) => renderItem(behavior, (
                <Button size="small" loading={busyKey === `unblock-${behavior.id}`}
                  onClick={() => change(behavior.id, 'unblock', 'Đã bỏ chặn.')}>Bỏ chặn</Button>
              )))}
            </ul>
          </>
        )}
      </section>

      <section className="student-rag-card">
        <h5>Xem trước AI sẽ giảng thế nào</h5>
        <p className="student-rag-card__hint">Thử một câu hỏi để xem AI chọn hành vi nào cho sinh viên này (không tính vào thống kê).</p>
        <div className="student-rag-preview">
          <Input value={preview.question} placeholder="Ví dụ: Đa hình trong Java là gì?" aria-label="Câu hỏi thử"
            onChange={(event) => setPreview((current) => ({ ...current, question: event.target.value }))}
            onPressEnter={runPreview} />
          <Select value={preview.domain} aria-label="Domain câu hỏi"
            options={[{ value: '', label: 'Không rõ domain' }, ...BEHAVIOR_DOMAINS]}
            onChange={(domain) => setPreview((current) => ({ ...current, domain }))} />
          <Button onClick={runPreview} loading={preview.loading}>Xem trước</Button>
        </div>
        {preview.result && (
          <>
            {preview.result.behaviors?.length ? (
              <ul className="student-rag-list">
                {preview.result.behaviors.map((item) => (
                  <li key={item.behavior.id} className="student-rag-item">
                    <p>{item.behavior.instruction}</p>
                    <div className="student-rag-item__meta">
                      <Tag>{REASON_LABELS[item.reason] || item.reason}</Tag>
                      <span className="teaching-behavior-stats">Điểm phù hợp {item.score}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Alert type="info" showIcon message="AI sẽ giảng theo cách mặc định cho câu hỏi này." />}
            {preview.result.promptBlock && (
              <pre className="student-rag-preview__block">{preview.result.promptBlock}</pre>
            )}
          </>
        )}
      </section>

      <PersonalBehaviorModal
        open={modal.open}
        editing={modal.editing}
        saving={savingBehavior}
        onClose={() => setModal({ open: false, editing: null })}
        onSubmit={savePersonal}
      />
    </div>
  );
}
