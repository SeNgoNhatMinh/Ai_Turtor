import { Alert, Button, Empty, Space, Tag, Typography } from 'antd';
import { ExternalLink, FileSearch } from 'lucide-react';
import StatusLabel from '../../../components/common/StatusLabel';
import {
  formatChapterPreviewPages,
  getChapterPrimaryPdfSource,
  getChapterStatusMeta,
  getDetectedFromLabel,
  getMaterialHealthMeta,
  isPdfMaterialSource,
} from '../expertTrainingUtils';
import ChapterExcerptView from './ChapterExcerptView';

const { Text, Title } = Typography;

export default function ChapterMaterialPreviewContent({
  preview,
  onOpenMaterial,
  showPdfJumpHint = true,
}) {
  if (!preview) return null;

  const title = preview.title || 'Chi tiết chương';
  const health = getMaterialHealthMeta(preview.materialHealth);
  const detectedFromLabel = getDetectedFromLabel(preview.detectedFrom);
  const chapterStatus = getChapterStatusMeta(preview.status);
  const pageLabel = formatChapterPreviewPages(preview);
  const primaryPdf = getChapterPrimaryPdfSource(preview);
  const canJumpToSection = Boolean(primaryPdf) && Number(preview.pageStart) > 0;

  const openPdfAtSection = () => {
    if (!primaryPdf) return;
    onOpenMaterial?.(primaryPdf, {
      pageStart: preview.pageStart,
      pageEnd: preview.pageEnd,
    });
  };

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
        <Space orientation="vertical" size={4} align="end">
          <Text type="secondary">
            {preview.chunkCount} chunks · {preview.approxChars.toLocaleString('vi-VN')} ký tự
          </Text>
          {canJumpToSection && (
            <Button
              type="primary"
              size="small"
              icon={<FileSearch size={14} />}
              onClick={openPdfAtSection}
            >
              Mở PDF tại mục chương ({pageLabel})
            </Button>
          )}
        </Space>
      </div>

      {showPdfJumpHint && canJumpToSection && (
        <Alert
          type="info"
          showIcon
          title="Sơ đồ và bố cục trang PDF"
          description="Phần text bên dưới là nội dung đã trích từ PDF. Hình, bảng và layout đầy đủ — dùng nút Mở PDF tại mục chương để nhảy đúng trang."
        />
      )}

      {!preview.hasMaterialContent && (
        <Alert
          type="warning"
          showIcon
          title="Chương chưa có nội dung đã index"
          description="Hãy bổ sung hoặc reindex học liệu trước khi soạn tri thức ngoài phạm vi tài liệu."
        />
      )}

      <section className="expert-training__chapter-excerpt" aria-labelledby="chapter-excerpt-heading">
        <h3 id="chapter-excerpt-heading">Nội dung tham khảo</h3>
        <ChapterExcerptView
          excerpt={preview.excerpt}
          truncated={preview.excerptTruncated}
          totalChars={preview.excerptTotalChars}
          fullSection={!preview.excerptTruncated}
        />
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
            <Space wrap size={[6, 0]}>
              {isPdfMaterialSource(source) && Number(preview.pageStart) > 0 && source.id === primaryPdf?.id && (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<FileSearch size={14} />}
                  onClick={openPdfAtSection}
                >
                  PDF · {pageLabel}
                </Button>
              )}
              <Button
                size="small"
                icon={<ExternalLink size={14} />}
                disabled={!isPdfMaterialSource(source)}
                title={isPdfMaterialSource(source) ? 'Mở PDF nguồn' : 'Chỉ nguồn PDF có thể mở bằng thao tác này'}
                onClick={() => onOpenMaterial?.(source, {
                  pageStart: source.id === primaryPdf?.id ? preview.pageStart : undefined,
                  pageEnd: source.id === primaryPdf?.id ? preview.pageEnd : undefined,
                })}
              >
                Mở PDF
              </Button>
            </Space>
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có học liệu nguồn." />}
      </section>
    </div>
  );
}
