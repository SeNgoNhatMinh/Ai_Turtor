import { Button, Empty, Space, Tag, Typography } from 'antd';
import { ExternalLink } from 'lucide-react';
import StatusLabel from '../../../components/common/StatusLabel';
import {
  formatChapterPreviewPages,
  getChapterPdfOpenTarget,
  getChapterStatusMeta,
  getDetectedFromLabel,
  getMaterialHealthMeta,
  isPdfMaterialSource,
} from '../expertTrainingUtils';
import ChapterPageViewer from './ChapterPageViewer';

const { Text, Title } = Typography;

export default function ChapterMaterialPreviewContent({
  courseId,
  preview,
  onOpenMaterial,
}) {
  if (!preview) return null;

  const title = preview.title || 'Chi tiết chương';
  const health = getMaterialHealthMeta(preview.materialHealth);
  const detectedFromLabel = getDetectedFromLabel(preview.detectedFrom);
  const chapterStatus = getChapterStatusMeta(preview.status);
  const pageLabel = formatChapterPreviewPages(preview);
  const pdfTarget = getChapterPdfOpenTarget(preview, preview);

  return (
    <div className="expert-training__chapter-preview">
      <div className="expert-training__chapter-preview-head">
        <div>
          <Title level={4}>{title}</Title>
          <Space wrap size={[6, 6]}>
            <Tag color={chapterStatus.color}>{chapterStatus.label}</Tag>
            <Tag color={health.color}>{health.label}</Tag>
            {detectedFromLabel && <Tag>{detectedFromLabel}</Tag>}
            {Number(preview.pageStart) > 0 && <Tag>{pageLabel}</Tag>}
          </Space>
        </div>
        <Text type="secondary">
          {preview.chunkCount} chunks · {preview.approxChars.toLocaleString('vi-VN')} ký tự
        </Text>
      </div>

      <ChapterPageViewer
        courseId={preview.courseId || courseId}
        materialId={pdfTarget?.source?.id}
        pageStart={pdfTarget?.pageStart}
        pageEnd={pdfTarget?.pageEnd}
        title={title}
      />

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
              title={isPdfMaterialSource(source) ? 'Tải PDF nguồn' : 'Chỉ nguồn PDF có thể mở bằng thao tác này'}
              onClick={() => onOpenMaterial?.(source, {
                pageStart: source.id === pdfTarget?.source?.id ? preview.pageStart : undefined,
                pageEnd: source.id === pdfTarget?.source?.id ? preview.pageEnd : undefined,
              })}
            >
              Tải PDF
            </Button>
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có học liệu nguồn." />}
      </section>
    </div>
  );
}
