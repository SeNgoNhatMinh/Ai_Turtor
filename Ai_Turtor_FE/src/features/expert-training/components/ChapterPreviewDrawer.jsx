import { Alert, Button, Drawer, Empty, Skeleton, Space, Typography } from 'antd';
import { ExternalLink, FileSearch, Play, Trash2 } from 'lucide-react';
import { parseChapterExcerptBlocks } from '../chapterExcerptFormat';
import { getChapterPdfOpenTarget } from '../expertTrainingUtils';
import ChapterPageViewer from './ChapterPageViewer';

const { Text } = Typography;

function ChapterFigureGallery({ images = [], sourcePageUrl }) {
  if (!images.length) {
    return (
      <Alert
        type="info"
        showIcon
        title="Chưa lấy được hình trong mục này"
        description={sourcePageUrl
          ? 'Một số trang docs chặn hotlink hoặc không có figure. Bấm Mở trang nguồn để xem đầy đủ.'
          : 'Tài liệu website chỉ lưu text khi import cũ. Mở trang nguồn nếu có.'}
        style={{ marginBottom: 12 }}
      />
    );
  }
  return (
    <div className="expert-training__chapter-figures" aria-label="Hình trong mục">
      <h3>Hình minh họa ({images.length})</h3>
      <div className="expert-training__chapter-figures-grid">
        {images.map((url) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="expert-training__chapter-figure">
            <img src={url} alt="Figure from course documentation" loading="lazy" referrerPolicy="no-referrer" />
          </a>
        ))}
      </div>
    </div>
  );
}

function ChapterExcerptView({ excerpt, truncated }) {
  const blocks = parseChapterExcerptBlocks(excerpt);
  if (!blocks.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Chưa có đoạn trích học liệu cho chương này."
      />
    );
  }
  return (
    <div className="expert-training__excerpt-view">
      <div className="expert-training__excerpt-scroll">
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            return <h4 key={`h-${index}`} className="expert-training__excerpt-heading">{block.text}</h4>;
          }
          if (block.type === 'list' || block.type === 'list-item') {
            return (
              <p key={`l-${index}`} className="expert-training__excerpt-list-item">
                {block.text}
              </p>
            );
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
      {truncated && (
        <Text type="secondary" className="expert-training__excerpt-truncated-note">
          Đã cắt ngắn. Bắt đầu chương để Teacher soạn theo học liệu đầy đủ.
        </Text>
      )}
    </div>
  );
}

function ChapterPreviewActions({
  chapter,
  preview,
  canReview,
  pendingAction,
  session,
  onStartChapter,
  onOpenMaterial,
  onIgnoreChapter,
}) {
  const title = preview?.title || chapter?.title || '';
  const chapterKey = chapter?.chapterKey || chapter?.id || '';
  const pdfTarget = getChapterPdfOpenTarget(chapter, preview);
  const sourcePageUrl = preview?.sourcePageUrl || '';
  const canStart = canReview
    && session?.key === 'NOT_STARTED'
    && Number(chapter?.chunkCount) > 0;

  return (
    <Space wrap className="expert-training__chapter-preview-actions">
      {pdfTarget && (
        <Button
          icon={<FileSearch size={16} />}
          onClick={() => onOpenMaterial?.(pdfTarget.source, {
            pageStart: pdfTarget.pageStart,
            pageEnd: pdfTarget.pageEnd,
          })}
        >
          Tải PDF
        </Button>
      )}
      {sourcePageUrl && (
        <Button
          icon={<ExternalLink size={16} />}
          onClick={() => window.open(sourcePageUrl, '_blank', 'noopener,noreferrer')}
        >
          Mở trang nguồn
        </Button>
      )}
      {canReview && (
        <Button
          danger
          icon={<Trash2 size={16} />}
          disabled={Boolean(pendingAction)}
          loading={pendingAction === `ignore-chapter:${chapterKey}`}
          onClick={() => onIgnoreChapter?.(chapter)}
        >
          Xóa khỏi mục lục
        </Button>
      )}
      {canReview && (
        <Button
          type="primary"
          icon={<Play size={16} />}
          disabled={!canStart || Boolean(pendingAction)}
          loading={pendingAction === `start-chapter:${title}`}
          onClick={() => onStartChapter?.(chapter)}
        >
          Bắt đầu chương
        </Button>
      )}
    </Space>
  );
}

export default function ChapterPreviewDrawer({
  courseId,
  chapter,
  preview,
  previewLoading = false,
  previewError = '',
  canReview,
  pendingAction,
  session,
  onClose,
  onStartChapter,
  onOpenMaterial,
  onIgnoreChapter,
}) {
  const title = preview?.title || chapter?.title || 'Nội dung chương';
  const pdfTarget = getChapterPdfOpenTarget(chapter, preview);
  const isHtmlMaterial = String(preview?.detectedFrom || chapter?.detectedFrom || '')
    .toUpperCase()
    .includes('HTML')
    || preview?.sourceMaterials?.some((s) => String(s.sourceType || '').toUpperCase().includes('HTML'));

  return (
    <Drawer
      title={title}
      open={Boolean(chapter)}
      onClose={onClose}
      size="large"
      rootClassName="expert-training__drawer"
      destroyOnHidden
    >
      {previewLoading && <Skeleton active paragraph={{ rows: 8 }} />}
      {!previewLoading && previewError && (
        <Alert type="warning" showIcon title="Không tải được nội dung chương" description={previewError} />
      )}
      {!previewLoading && !previewError && pdfTarget && (
        <ChapterPageViewer
          courseId={preview?.courseId || courseId}
          materialId={pdfTarget.source?.id}
          pageStart={pdfTarget.pageStart}
          pageEnd={pdfTarget.pageEnd}
          title={title}
        />
      )}
      {!previewLoading && !previewError && !pdfTarget && (
        <section className="expert-training__chapter-excerpt" aria-label="Đoạn trích học liệu">
          <h3>{isHtmlMaterial ? 'Nội dung website đã import' : 'Đoạn trích học liệu'}</h3>
          {isHtmlMaterial && (
            <ChapterFigureGallery
              images={preview?.imageUrls || []}
              sourcePageUrl={preview?.sourcePageUrl || ''}
            />
          )}
          <ChapterExcerptView
            excerpt={preview?.excerpt || ''}
            truncated={Boolean(preview?.excerptTruncated)}
          />
        </section>
      )}

      {canReview && session?.key && session.key !== 'NOT_STARTED' && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          title={session.label}
          description="Chương này đã có phiên train hoặc bài thi."
        />
      )}

      {chapter && (
        <section className="expert-training__chapter-task-builder">
          {canReview && (
            <div>
              <h3>Phiên train chương này</h3>
              <Text type="secondary">
                {pdfTarget
                  ? 'Lật trang sách ở trên để xem layout, hình và bảng. Xóa khỏi mục lục chỉ ẩn mục nhiễu; file giáo trình vẫn giữ nguyên.'
                  : 'Website: xem hình + đoạn trích, hoặc Mở trang nguồn. Rồi Bắt đầu chương để tạo task Teacher.'}
              </Text>
            </div>
          )}
          <ChapterPreviewActions
            chapter={chapter}
            preview={preview}
            canReview={canReview}
            pendingAction={pendingAction}
            session={session}
            onStartChapter={onStartChapter}
            onOpenMaterial={onOpenMaterial}
            onIgnoreChapter={onIgnoreChapter}
          />
        </section>
      )}
    </Drawer>
  );
}
