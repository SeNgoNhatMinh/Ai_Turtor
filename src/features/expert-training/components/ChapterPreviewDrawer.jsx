import { useState } from 'react';
import { Alert, Button, Checkbox, Drawer, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { ExternalLink, ListChecks } from 'lucide-react';
import StatusLabel from '../../../components/common/StatusLabel';
import {
  getChapterStatusMeta,
  getDetectedFromLabel,
  getMaterialHealthMeta,
  isPdfMaterialSource,
} from '../expertTrainingUtils';

const { Paragraph, Text, Title } = Typography;

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
  const title = preview?.title || chapter?.title || 'Chi tiết chương';
  const health = getMaterialHealthMeta(preview?.materialHealth || chapter?.materialHealth);
  const chapterStatus = getChapterStatusMeta(preview?.status || chapter?.status);
  const createKey = `create-chapter-tasks:${title}`;

  const createTasks = async () => {
    if (!title || (!includeTraining && !includeEvaluation)) return;
    await onCreateTasks?.(title, {
      includeTrainingGoldTask: includeTraining,
      includeEvaluationGoldTask: includeEvaluation,
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
        <div className="expert-training__chapter-preview">
          <div className="expert-training__chapter-preview-head">
            <div>
              <Title level={4}>{title}</Title>
              <Space wrap size={[6, 6]}>
                <Tag color={chapterStatus.color}>{chapterStatus.label}</Tag>
                <Tag color={health.color}>{health.label}</Tag>
                <Tag>{getDetectedFromLabel(preview.detectedFrom)}</Tag>
              </Space>
            </div>
            <Text type="secondary">{preview.chunkCount} chunks · {preview.approxChars.toLocaleString('vi-VN')} ký tự</Text>
          </div>

          {!preview.hasMaterialContent && (
            <Alert
              type="warning"
              showIcon
              title="Chương chưa có nội dung đã index"
              description="Hãy bổ sung hoặc reindex học liệu trước khi yêu cầu giảng viên soạn tri thức."
            />
          )}

          <section className="expert-training__chapter-excerpt" aria-labelledby="chapter-excerpt-heading">
            <h3 id="chapter-excerpt-heading">Nội dung tham khảo</h3>
            <Paragraph>{preview.excerpt || 'Backend chưa trả về trích đoạn cho chương này.'}</Paragraph>
            {preview.excerptTruncated && (
              <Text type="secondary">Bản xem trước đã rút gọn từ {preview.excerptTotalChars.toLocaleString('vi-VN')} ký tự.</Text>
            )}
          </section>

          <section className="expert-training__chapter-sources" aria-labelledby="chapter-sources-heading">
            <h3 id="chapter-sources-heading">Nguồn học liệu</h3>
            {preview.sourceMaterials.length ? preview.sourceMaterials.map((source) => (
              <div key={source.id} className="expert-training__chapter-source">
                <div>
                  <strong>{source.title}</strong>
                  <Space wrap size={[6, 4]}>
                    <Tag>{source.sourceType}</Tag>
                    <StatusLabel status={source.indexingStatus} />
                  </Space>
                </div>
                <Button
                  size="small"
                  icon={<ExternalLink size={14} />}
                  disabled={!isPdfMaterialSource(source)}
                  title={isPdfMaterialSource(source) ? 'Mở PDF nguồn' : 'Chỉ nguồn PDF có thể mở bằng thao tác này'}
                  onClick={() => onOpenMaterial?.(source)}
                >
                  Mở PDF
                </Button>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có học liệu nguồn." />}
          </section>

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
              </Space>
              <Button
                type="primary"
                icon={<ListChecks size={16} />}
                disabled={(!includeTraining && !includeEvaluation) || Boolean(pendingAction)}
                loading={pendingAction === createKey}
                onClick={createTasks}
              >
                Tạo task mở
              </Button>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
