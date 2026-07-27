import { useState } from 'react';
import { Alert, Button, Checkbox, Drawer, Empty, Skeleton, Space, Tooltip } from 'antd';
import { ListChecks } from 'lucide-react';
import ChapterMaterialPreviewContent from './ChapterMaterialPreviewContent';
import {
  defaultExpertTaskDueAt,
  toDateTimeLocalValue,
  toExpertTaskDueAtPayload,
} from '../expertTrainingUtils';

export default function ChapterPreviewDrawer({
  chapter,
  preview,
  loading,
  error,
  canReview,
  pendingAction,
  onClose,
  onCreateTasks,
  onOpenMaterial,
}) {
  const [includeTraining, setIncludeTraining] = useState(true);
  const [includeEvaluation, setIncludeEvaluation] = useState(false);
  const [dueAtLocal, setDueAtLocal] = useState(() => toDateTimeLocalValue(defaultExpertTaskDueAt(7)));
  const title = preview?.title || chapter?.title || 'Chi tiết chương';
  const createKey = `create-chapter-tasks:${title}`;
  const isConfirmed = String(preview?.status || chapter?.status || '').toUpperCase() === 'CONFIRMED';
  const canCreateTasks = isConfirmed && Boolean(preview?.hasMaterialContent);

  const createTasks = async () => {
    if (!title || !canCreateTasks || (!includeTraining && !includeEvaluation)) return;
    await onCreateTasks?.(title, {
      includeTrainingGoldTask: includeTraining,
      includeEvaluationGoldTask: includeEvaluation,
      dueAt: toExpertTaskDueAtPayload(dueAtLocal),
    });
  };

  return (
    <Drawer
      title="Tài liệu chương"
      open={Boolean(chapter)}
      onClose={onClose}
      size="large"
      rootClassName="expert-training__drawer"
      destroyOnHidden
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : error ? (
        <Alert type="error" showIcon title="Không thể tải nội dung chương" description={error} />
      ) : !preview ? (
        <Empty description="Chưa có dữ liệu preview cho chương này." />
      ) : (
        <>
          <ChapterMaterialPreviewContent preview={preview} onOpenMaterial={onOpenMaterial} />

          {canReview && (
            <section className="expert-training__chapter-task-builder" aria-labelledby="chapter-task-heading">
              <div>
                <h3 id="chapter-task-heading">Tạo task cho giảng viên</h3>
                <p>Task ở trạng thái mở. Giảng viên phù hợp sẽ tự nhận việc.</p>
              </div>
              <Space orientation="vertical">
                <Checkbox checked={includeTraining} onChange={(event) => setIncludeTraining(event.target.checked)}>
                  Training Gold Q&A — đưa vào RAG sau khi duyệt
                </Checkbox>
                <Checkbox checked={includeEvaluation} onChange={(event) => setIncludeEvaluation(event.target.checked)}>
                  Evaluation holdout — chỉ dùng kiểm thử
                </Checkbox>
                <label className="expert-training__task-due-field">
                  <span>Hạn hoàn thành (giáo viên sẽ thấy trên task)</span>
                  <input
                    type="datetime-local"
                    value={dueAtLocal}
                    onChange={(event) => setDueAtLocal(event.target.value)}
                  />
                </label>
              </Space>
              {!isConfirmed && (
                <Alert
                  type="warning"
                  showIcon
                  title="Xác nhận chapter trước khi tạo task"
                  description="Task phải tham chiếu chapter canonical đã được Senior/Admin xác nhận."
                />
              )}
              {isConfirmed && !preview.hasMaterialContent && (
                <Alert
                  type="warning"
                  showIcon
                  title="Chapter chưa có nội dung index"
                  description="Hãy upload hoặc reindex học liệu trước khi yêu cầu Teacher soạn nội dung."
                />
              )}
              <Tooltip title={!isConfirmed
                ? 'Chapter chưa được xác nhận'
                : !preview.hasMaterialContent
                  ? 'Chapter chưa có nội dung index'
                  : ''}>
                <span>
                  <Button
                    type="primary"
                    icon={<ListChecks size={16} />}
                    disabled={!canCreateTasks || (!includeTraining && !includeEvaluation) || Boolean(pendingAction)}
                    loading={pendingAction === createKey}
                    onClick={createTasks}
                  >
                    Tạo task mở
                  </Button>
                </span>
              </Tooltip>
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}
