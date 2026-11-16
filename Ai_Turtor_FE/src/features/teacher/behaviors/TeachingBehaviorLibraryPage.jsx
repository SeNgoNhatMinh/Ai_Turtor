import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Form, Input, Modal, Pagination, Popconfirm, Select, Skeleton, Space, Tag } from 'antd';
import { Plus, RefreshCw } from 'lucide-react';
import { queryKeys } from '../../../app/queryKeys';
import PageHeader from '../../../components/common/PageHeader';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray } from '../../../services/normalizers';
import { teacherApi } from '../../../services/teacherApi';
import { teachingBehaviorApi } from '../../../services/teachingBehaviorApi';
import { uniqueClassScopes } from '../tutoring/teacherTutoringStudents';
import {
  BEHAVIOR_DOMAINS,
  BEHAVIOR_SCOPE_LABELS,
  BEHAVIOR_STATUS_COLORS,
  BEHAVIOR_STATUS_LABELS,
  EXPLANATION_STRATEGIES,
  MAX_BEHAVIOR_LENGTH,
  SUPPORT_LEVEL_OPTIONS,
} from './behaviorConstants';
import { BehaviorScopeTag, BehaviorStats } from './BehaviorTags';
import BehaviorDetailDrawer from './BehaviorDetailDrawer';
import './TeachingBehaviors.css';

const PAGE_SIZE = 20;
const EMPTY_LIST = [];
const ALL = 'ALL';
const SHARED_SCOPE_OPTIONS = ['COURSE', 'DOMAIN'].map((value) => ({
  value,
  label: BEHAVIOR_SCOPE_LABELS[value],
}));

function levelLabels(levels) {
  if (!levels?.length) return 'Mọi mức';
  return levels
    .map((level) => SUPPORT_LEVEL_OPTIONS.find((option) => option.value === level)?.label || level)
    .join(', ');
}

function toApiFilter(value) {
  return !value || value === ALL ? undefined : value;
}

function BehaviorFormModal({ open, editing, courseOptions, onClose, onSaved, triggerToast }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const scope = Form.useWatch('scope', form);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      form.setFieldsValue(editing ? {
        scope: editing.scope,
        courseId: editing.courseId,
        domain: editing.domain,
        name: editing.name,
        strategy: editing.strategy,
        description: editing.description,
        supportLevels: editing.supportLevels || [],
        instruction: editing.instruction,
        targetSignals: editing.targetSignals || [],
      } : {
        scope: 'COURSE',
        courseId: courseOptions[0]?.value,
        domain: undefined,
        name: '',
        strategy: undefined,
        description: '',
        supportLevels: [],
        instruction: '',
        targetSignals: [],
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, editing, courseOptions, form]);

  const submit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const saved = editing
        ? await teachingBehaviorApi.update(editing.id, values)
        : await teachingBehaviorApi.create(values);
      triggerToast?.(editing ? 'Đã cập nhật hành vi giảng dạy.' : 'Đã thêm hành vi vào kho.');
      onSaved(saved);
    } catch (error) {
      if (error?.errorFields) return;
      triggerToast?.(getUserFacingError(error, 'Không lưu được hành vi giảng dạy.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      destroyOnHidden
      title={editing ? 'Sửa hành vi giảng dạy' : 'Thêm hành vi vào kho RAG behavior'}
      okText={editing ? 'Lưu thay đổi' : 'Thêm vào kho'}
      cancelText="Huỷ"
    >
      <Form form={form} layout="vertical" requiredMark={false} className="teaching-behavior-form">
        <Form.Item name="name" label="Tên">
          <Input maxLength={120} placeholder="Ví dụ: Ví dụ thực tế trước định nghĩa" />
        </Form.Item>
        <Form.Item name="strategy" label="Phong cách diễn giải" rules={[{ required: true, message: 'Chọn phong cách' }]}>
          <Select options={EXPLANATION_STRATEGIES} placeholder="Chọn một trong sáu phong cách" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={2} maxLength={500} placeholder="Khi nào dùng phong cách này" />
        </Form.Item>
        <Form.Item name="scope" label="Phạm vi dùng chung" rules={[{ required: true, message: 'Chọn phạm vi' }]}>
          <Select
            disabled={Boolean(editing)}
            options={editing?.scope === 'STUDENT'
              ? [{ value: 'STUDENT', label: BEHAVIOR_SCOPE_LABELS.STUDENT }]
              : SHARED_SCOPE_OPTIONS}
          />
        </Form.Item>
        {scope === 'COURSE' && (
          <Form.Item name="courseId" label="Môn học" rules={[{ required: true, message: 'Chọn môn học' }]}>
            <Select
              disabled={Boolean(editing)}
              options={courseOptions}
              placeholder={courseOptions.length ? 'Chọn môn' : 'Chưa có môn được phân công'}
              notFoundContent="Bạn chưa được phân công môn nào"
            />
          </Form.Item>
        )}
        {scope === 'DOMAIN' && (
          <Form.Item
            name="domain"
            label="Domain"
            rules={[{ required: true, message: 'Chọn domain' }]}
            extra="Hành vi theo domain dùng cho mọi môn có cùng domain (ví dụ OOP cho Java, C#...)."
          >
            <Select options={BEHAVIOR_DOMAINS} placeholder="Chọn domain" showSearch optionFilterProp="label" />
          </Form.Item>
        )}
        <Form.Item
          name="instruction"
          label="Cách giảng (AI sẽ làm theo)"
          rules={[{ required: true, whitespace: true, message: 'Nhập cách giảng' }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={MAX_BEHAVIOR_LENGTH}
            showCount
            placeholder="Ví dụ: Giải thích bằng ví dụ đời thường trước, rồi mới đưa đoạn code ngắn"
          />
        </Form.Item>
        <Form.Item name="supportLevels" label="Áp dụng cho mức hỗ trợ" extra="Để trống nghĩa là áp dụng cho mọi mức.">
          <Select mode="multiple" allowClear options={SUPPORT_LEVEL_OPTIONS} placeholder="Mọi mức" />
        </Form.Item>
        <Form.Item
          name="targetSignals"
          label="Dấu hiệu sinh viên phù hợp"
          extra="Nhấn Enter sau mỗi dấu hiệu, ví dụ: hay nhầm overload và override."
        >
          <Select mode="tags" tokenSeparators={[';']} placeholder="Thêm dấu hiệu" open={false} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function TeachingBehaviorLibraryPage({ teacherId, triggerToast }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    scope: ALL,
    courseId: ALL,
    domain: ALL,
    status: ALL,
    q: '',
  });
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: keyword.trim() }));
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const classesQuery = useQuery({
    queryKey: queryKeys.teacherClasses(teacherId),
    queryFn: async ({ signal }) =>
      asArray(await teacherApi.getClassSections(teacherId, { signal }), 'classes', 'classSections', 'content'),
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });
  const courseOptions = useMemo(() => {
    const seen = new Set();
    return uniqueClassScopes(classesQuery.data || EMPTY_LIST)
      .filter((scope) => !seen.has(scope.courseId) && seen.add(scope.courseId))
      .map((scope) => ({ value: scope.courseId, label: scope.courseId }));
  }, [classesQuery.data]);

  const listFilters = {
    scope: toApiFilter(filters.scope),
    courseId: toApiFilter(filters.courseId),
    domain: toApiFilter(filters.domain),
    status: toApiFilter(filters.status),
    q: filters.q || undefined,
    page,
    size: PAGE_SIZE,
  };
  const behaviorsQuery = useQuery({
    queryKey: queryKeys.teachingBehaviors(listFilters),
    queryFn: ({ signal }) => teachingBehaviorApi.list(listFilters, { signal }),
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  });
  const overviewQuery = useQuery({
    queryKey: ['teacher', 'teaching-behaviors', 'overview'],
    queryFn: ({ signal }) => teachingBehaviorApi.overview({ signal }),
    staleTime: 15_000,
  });
  const overview = overviewQuery.data || {};
  const items = behaviorsQuery.data?.items ?? EMPTY_LIST;
  const total = behaviorsQuery.data?.totalElements || 0;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value || ALL }));
    setPage(0);
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behaviors'] });

  const toggleStatus = async (behavior) => {
    const next = behavior.status === 'RETIRED' ? 'APPROVED' : 'RETIRED';
    setBusyId(behavior.id);
    try {
      await teachingBehaviorApi.setStatus(behavior.id, next);
      triggerToast?.(next === 'RETIRED' ? 'AI sẽ không dùng hành vi này nữa.' : 'Đã bật lại hành vi.');
      refresh();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không đổi được trạng thái.'));
    } finally {
      setBusyId('');
    }
  };

  const creatorLabel = (behavior) => {
    const name = behavior.createdByName || '';
    if (name && !/^[0-9a-f-]{16,}$/i.test(name)) return name;
    if (String(behavior.createdBy || '').toLowerCase().includes('ai')) return 'AI Tutor';
    return 'Giảng viên';
  };

  return (
    <div className="portal-section teacher-feature-page teaching-behavior-page">
      <PageHeader
        eyebrow="RAG BEHAVIOR"
        title="Kho hành vi giảng dạy"
        description="AI tự áp phong cách vừa đánh giá vào câu trả lời sau và đánh số các tiêu đề. Giảng viên vẫn sửa hoặc tắt. Lịch sử ghi lần RAG thực sự đã dùng."
        actions={(
          <Space wrap>
            <Button icon={<RefreshCw size={15} />} onClick={refresh} loading={behaviorsQuery.isFetching}>
              Làm mới
            </Button>
            <Button type="primary" icon={<Plus size={15} />} onClick={() => setModal({ open: true, editing: null })}>
              Thêm hành vi
            </Button>
          </Space>
        )}
      />

      <section className="teaching-behavior-stats" aria-label="Tổng quan hành vi">
        <article><strong>{overview.totalBehaviors ?? '—'}</strong><span>Mẫu</span></article>
        <article><strong>{overview.activeBehaviors ?? '—'}</strong><span>Đang bật</span></article>
        <article><strong>{overview.pendingApproval ?? '—'}</strong><span>Chờ duyệt</span></article>
        <article><strong>{overview.assignedBehaviors ?? '—'}</strong><span>Đang gán</span></article>
        <article><strong>{overview.appliedExecutions ?? '—'}</strong><span>Đã dùng</span></article>
        <article><strong>{overview.skippedExecutions ?? '—'}</strong><span>Gán nhưng không chọn</span></article>
      </section>

      <section className="teaching-behavior-panel">
        <div className="teaching-behavior-filters">
          <Input.Search
            allowClear
            placeholder="Tìm theo nội dung cách giảng"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="Tìm hành vi"
          />
          <Select
            value={filters.scope}
            onChange={(value) => updateFilter('scope', value)}
            aria-label="Lọc phạm vi"
            options={[
              { value: ALL, label: 'Mọi phạm vi' },
              ...Object.entries(BEHAVIOR_SCOPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Select
            value={filters.courseId}
            onChange={(value) => updateFilter('courseId', value)}
            aria-label="Lọc môn"
            options={[{ value: ALL, label: 'Mọi môn' }, ...courseOptions]}
          />
          <Select
            value={filters.domain}
            onChange={(value) => updateFilter('domain', value)}
            aria-label="Lọc domain"
            options={[{ value: ALL, label: 'Mọi domain' }, ...BEHAVIOR_DOMAINS]}
            showSearch
            optionFilterProp="label"
          />
          <Select
            value={filters.status}
            onChange={(value) => updateFilter('status', value)}
            aria-label="Lọc trạng thái"
            options={[
              { value: ALL, label: 'Mọi trạng thái' },
              ...Object.entries(BEHAVIOR_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        {behaviorsQuery.isError && (
          <Alert
            type="error"
            showIcon
            className="teaching-behavior-alert"
            message="Không tải được kho hành vi"
            description={getUserFacingError(behaviorsQuery.error, 'Thử nhấn Làm mới hoặc đăng nhập lại.')}
            action={<Button size="small" onClick={refresh}>Thử lại</Button>}
          />
        )}

        {behaviorsQuery.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
        {!behaviorsQuery.isLoading && items.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={behaviorsQuery.isError
              ? 'Không tải được dữ liệu'
              : filters.q || filters.scope !== ALL || filters.status !== ALL || filters.courseId !== ALL || filters.domain !== ALL
                ? 'Không có hành vi khớp bộ lọc hiện tại'
                : 'Chưa có hành vi nào trong kho. Hãy thêm cách giảng để AI dùng lại cho sinh viên sau.'}
          >
            {!behaviorsQuery.isError && (
              <Button type="primary" icon={<Plus size={15} />} onClick={() => setModal({ open: true, editing: null })}>
                Thêm hành vi đầu tiên
              </Button>
            )}
          </Empty>
        )}
        <div className="behavior-card-list">
          {items.map((behavior) => (
            <article key={behavior.id} className="behavior-card">
              <div className="behavior-card__body">
                <div className="behavior-card__title">
                  <strong>{behavior.name || behavior.strategy || 'Chưa đặt tên'}</strong>
                  <BehaviorScopeTag behavior={behavior} />
                  <Tag color={BEHAVIOR_STATUS_COLORS[behavior.status]}>
                    {BEHAVIOR_STATUS_LABELS[behavior.status] || behavior.status}
                  </Tag>
                </div>
                <p>{behavior.instruction}</p>
                <div className="behavior-card__meta">
                  <span>{behavior.strategy || 'Chưa chọn phong cách'}</span>
                  <span>v{behavior.version || 1}</span>
                  <span>{levelLabels(behavior.supportLevels)}</span>
                  <BehaviorStats behavior={behavior} />
                  <span>{creatorLabel(behavior)}</span>
                </div>
              </div>
              <div className="teaching-behavior-actions">
                <Button size="small" onClick={() => setDetail(behavior)}>Chi tiết</Button>
                <Button
                  size="small"
                  onClick={() => setModal({ open: true, editing: behavior })}
                  disabled={behavior.status === 'REJECTED'}
                >
                  Sửa
                </Button>
                {behavior.status !== 'REJECTED' && (
                  <Popconfirm
                    title={behavior.status === 'RETIRED' ? 'Bật lại hành vi này?' : 'Ngừng dùng hành vi này?'}
                    okText="Đồng ý"
                    cancelText="Huỷ"
                    onConfirm={() => toggleStatus(behavior)}
                  >
                    <Button size="small" danger={behavior.status !== 'RETIRED'} loading={busyId === behavior.id}>
                      {behavior.status === 'RETIRED' ? 'Bật lại' : 'Tắt'}
                    </Button>
                  </Popconfirm>
                )}
              </div>
            </article>
          ))}
        </div>
        {total > PAGE_SIZE && (
          <Pagination
            current={page + 1}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            showTotal={(count) => `${count} hành vi`}
            onChange={(next) => setPage(next - 1)}
          />
        )}
      </section>

      <BehaviorFormModal
        open={modal.open}
        editing={modal.editing}
        courseOptions={courseOptions}
        triggerToast={triggerToast}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={() => {
          setModal({ open: false, editing: null });
          setFilters((current) => ({ ...current, status: ALL }));
          refresh();
        }}
      />
      <BehaviorDetailDrawer
        behavior={detail}
        courseOptions={courseOptions}
        triggerToast={triggerToast}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
