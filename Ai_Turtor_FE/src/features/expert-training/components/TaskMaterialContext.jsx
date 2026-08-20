import { Alert, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { ExternalLink } from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import StatusLabel from '../../../components/common/StatusLabel';
import ChapterPageViewer from './ChapterPageViewer';
import {
  getDetectedFromLabel,
  getChapterPdfOpenTarget,
  getChapterStatusMeta,
  getMaterialHealthMeta,
  isPdfMaterialSource,
} from '../expertTrainingUtils';

const { Text } = Typography;

export default function TaskMaterialContext({
  preview,
  loading,
  error,
  onOpenMaterial,
}) {
  if (loading) {
    return (
      <Card size="small" title="Tài liệu chương" className="expert-training__task-material">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (error) {
    return <Alert type="warning" showIcon title="Không thể tải tài liệu chương" description={error} />;
  }

  if (!preview) {
    return (
      <Card size="small" title="Tài liệu chương" className="expert-training__task-material">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Task chưa có chapter khớp với học liệu đã index." />
      </Card>
    );
  }

  const health = getMaterialHealthMeta(preview.materialHealth);
  const chapterStatus = getChapterStatusMeta(preview.status);
  const detectedFromLabel = getDetectedFromLabel(preview.detectedFrom);

  return (
    <Card
      size="small"
      title="Tài liệu chương"
      extra={<Tag color={health.color}>{health.label}</Tag>}
      className="expert-training__task-material"
    >
      <div className="expert-training__task-material-content">
        <div>
          <strong>{preview.title}</strong>
          <Space wrap size={[6, 4]}>
            <Tag color={chapterStatus.color}>{chapterStatus.label}</Tag>
            {detectedFromLabel && <Tag>{detectedFromLabel}</Tag>}
            <Text type="secondary">{preview.chunkCount} chunks</Text>
          </Space>
        </div>

        {!preview.hasMaterialContent && (
          <Alert
            type="warning"
            showIcon
            title="Chưa có nội dung đủ để tham khảo"
            description="Không nên soạn tri thức ngoài phạm vi học liệu của môn."
          />
        )}

        <ChapterPageViewer
          courseId={preview.courseId}
          materialId={getChapterPdfOpenTarget(preview, preview)?.source?.id}
          pageStart={preview.pageStart}
          pageEnd={preview.pageEnd}
          title={preview.title}
        />

        <div className="expert-training__task-material-sources">
          <strong>Nguồn tham khảo</strong>
          {preview.sourceMaterials.length ? preview.sourceMaterials.map((source) => (
            <div key={source.id} className="expert-training__task-material-source">
              <div>
                <span>{source.title}</span>
                <StatusLabel status={source.indexingStatus} />
              </div>
              {isPdfMaterialSource(source) ? (
                <ActionButton
                  size="small"
                  icon={<ExternalLink size={14} />}
                  onClick={() => onOpenMaterial?.(source)}
                >
                  Mở PDF
                </ActionButton>
              ) : <Tag>{source.sourceType || 'Nguồn khác'}</Tag>}
            </div>
          )) : <Text type="secondary">Không có nguồn đính kèm.</Text>}
        </div>
      </div>
    </Card>
  );
}
