import { Button, Input, Select, Space } from 'antd';
import { RefreshCw } from 'lucide-react';
import ScopeBar from '../../../components/common/ScopeBar';

const MODE_OPTIONS = [
  { value: '', label: 'Tất cả mode' },
  { value: 'RAG', label: 'RAG' },
  { value: 'CODE', label: 'CODE' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ACTIVE', label: 'Đang dùng' },
  { value: 'SENIOR_APPROVED', label: 'Senior duyệt' },
  { value: 'SENIOR_CORRECTED', label: 'Đã sửa' },
  { value: 'DISABLED', label: 'Đã tắt' },
];

export default function AnswerCacheFilters({
  courseId,
  courseOptions = [],
  loadingCourses = false,
  filters,
  loading,
  onCourseChange,
  onChange,
  onRefresh,
}) {
  return (
    <ScopeBar
      className="answer-cache-filters"
      actions={(
        <Button icon={<RefreshCw size={16} />} loading={loading || loadingCourses} onClick={onRefresh}>
          Làm mới
        </Button>
      )}
    >
      <Space wrap size="middle">
        <Select
          showSearch
          placeholder="Chọn môn học"
          value={courseId || undefined}
          options={courseOptions}
          loading={loadingCourses}
          onChange={onCourseChange}
          optionFilterProp="label"
          style={{ width: 260 }}
        />
        <Input
          allowClear
          placeholder="Lọc classId"
          value={filters.classId}
          onChange={(event) => onChange({ ...filters, classId: event.target.value })}
          style={{ width: 180 }}
        />
        <Select
          value={filters.mode}
          options={MODE_OPTIONS}
          onChange={(value) => onChange({ ...filters, mode: value })}
          style={{ width: 160 }}
        />
        <Select
          value={filters.reviewStatus}
          options={STATUS_OPTIONS}
          onChange={(value) => onChange({ ...filters, reviewStatus: value })}
          style={{ width: 180 }}
        />
      </Space>
    </ScopeBar>
  );
}
