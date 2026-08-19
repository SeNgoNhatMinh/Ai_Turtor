import { Alert, Button, Drawer, Space, Typography } from 'antd';
import { FileSearch, Play, Trash2 } from 'lucide-react';
import { getChapterPdfOpenTarget } from '../expertTrainingUtils';
import ChapterPageViewer from './ChapterPageViewer';

const { Text } = Typography;

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
  canReview,
  pendingAction,
  session,
  onClose,
  onStartChapter,
  onOpenMaterial,
  onIgnoreChapter,
}) {
  const title = preview?.title || chapter?.title || 'Trang sách';
  const pdfTarget = getChapterPdfOpenTarget(chapter, preview);

  return (
    <Drawer
      title={title}
      open={Boolean(chapter)}
      onClose={onClose}
      size="large"
      rootClassName="expert-training__drawer"
      destroyOnHidden
    >
      <ChapterPageViewer
        courseId={preview?.courseId || courseId}
        materialId={pdfTarget?.source?.id}
        pageStart={pdfTarget?.pageStart}
        pageEnd={pdfTarget?.pageEnd}
        title={title}
      />

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
                Lật trang sách ở trên để xem layout, hình và bảng. Xóa khỏi mục lục chỉ ẩn mục nhiễu;
                file giáo trình vẫn giữ nguyên.
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
