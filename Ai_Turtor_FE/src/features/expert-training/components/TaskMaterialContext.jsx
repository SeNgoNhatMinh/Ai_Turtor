import { Alert, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { ExternalLink } from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import StatusLabel from '../../../components/common/StatusLabel';
import { parseChapterExcerptBlocks } from '../chapterExcerptFormat';
import ChapterPageViewer from './ChapterPageViewer';
import {
  getDetectedFromLabel,
  getChapterPdfOpenTarget,
  getChapterStatusMeta,
  getMaterialHealthMeta,
  isPdfMaterialSource,
} from '../expertTrainingUtils';

const { Text } = Typography;

function ExcerptBlocks({ excerpt }) {
  const blocks = parseChapterExcerptBlocks(excerpt);
  if (!blocks.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đoạn trích học liệu." />;
  }
  return (
    <div className="expert-training__excerpt-scroll expert-training__task-material-excerpt">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <h4 key={`h-${index}`} className="expert-training__excerpt-heading">{block.text}</h4>;
        }
        if (block.type === 'list' || block.type === 'list-item') {
          return <p key={`l-${index}`} className="expert-training__excerpt-list-item">{block.text}</p>;
        }
        if (block.type === 'code') {
          return (
            <pre key={`c-${index}`} className="expert-training__excerpt-sample-code">
              <code>{block.text}</code>
            </pre>
          );
        }
        return <p key={`p-${index}`} className="expert-training__excerpt-paragraph">{block.text}</p>;
      })}
    </div>
  );
}

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
  const pdfTarget = getChapterPdfOpenTarget(preview, preview);

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

        {pdfTarget ? (
          <ChapterPageViewer
            courseId={preview.courseId}
            materialId={pdfTarget.source?.id}
            pageStart={pdfTarget.pageStart}
            pageEnd={pdfTarget.pageEnd}
            title={preview.title}
          />
        ) : (
          <>
            {Array.isArray(preview.imageUrls) && preview.imageUrls.length > 0 && (
              <div className="expert-training__chapter-figures-grid">
                {preview.imageUrls.slice(0, 8).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="expert-training__chapter-figure">
                    <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  </a>
                ))}
              </div>
            )}
            {preview.sourcePageUrl && (
              <ActionButton
                size="small"
                icon={<ExternalLink size={14} />}
                onClick={() => window.open(preview.sourcePageUrl, '_blank', 'noopener,noreferrer')}
              >
                Mở trang nguồn
              </ActionButton>
            )}
            <ExcerptBlocks excerpt={preview.excerpt || ''} />
          </>
        )}

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
