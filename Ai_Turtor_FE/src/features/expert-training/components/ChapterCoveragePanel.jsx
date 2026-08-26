import { useMemo, useState } from 'react';
import { Alert, Button, Input, Segmented, Tag, Tooltip } from 'antd';
import { BookOpen, Eye, FileSearch, Play, RefreshCw, Search, Trash2 } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import { CollectionPagination } from '../../../components/common/CollectionControls';
import MetricStrip from '../../../components/common/MetricStrip';
import { confirmDanger } from '../../../components/common/confirmDialog';
import { useCollectionView } from '../../../hooks/useCollectionView';
import {
  formatChapterPages,
  getChapterPdfOpenTarget,
  getChapterSessionState,
} from '../expertTrainingUtils';
import ChapterPreviewDrawer from './ChapterPreviewDrawer';

const SESSION_FILTERS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NOT_STARTED', label: 'Chưa train' },
  { value: 'IN_PROGRESS', label: 'Đang train' },
  { value: 'EXAM_READY', label: 'Có bài thi' },
  { value: 'INDEXED', label: 'Đã nạp RAG' },
];

function chapterMarker(chapter, index) {
  const match = String(chapter.title || '').match(/^(\d+(?:\.\d+)*)/);
  if (match) return match[1];
  if (Number(chapter.tocLevel) > 0) return '';
  return String(index + 1).padStart(2, '0');
}

export default function ChapterCoveragePanel({
  courseId,
  chapters,
  tasks = [],
  goldQa = [],
  loading,
  error,
  canReview,
  pendingAction,
  chapterPreview = null,
  chapterPreviewLoading = false,
  chapterPreviewError = '',
  onRefresh,
  onForceRefresh,
  onClosePreview,
  onOpenPreview,
  onStartChapter,
  onOpenMaterial,
  onOpenExam,
  onIgnoreChapter,
}) {
  const [keyword, setKeyword] = useState('');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [selectedChapter, setSelectedChapter] = useState(null);

  const rows = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi-VN');
    return chapters
      .map((chapter, index) => ({
        chapter,
        index,
        session: getChapterSessionState(chapter, tasks, goldQa),
      }))
      .filter(({ chapter, session }) => {
        const matchesQuery = !query || chapter.title.toLocaleLowerCase('vi-VN').includes(query);
        const matchesFilter = sessionFilter === 'ALL' || session.key === sessionFilter;
        return matchesQuery && matchesFilter;
      });
  }, [chapters, goldQa, keyword, sessionFilter, tasks]);

  const summary = useMemo(() => {
    const counts = { total: chapters.length, notStarted: 0, inProgress: 0, exam: 0, indexed: 0 };
    chapters.forEach((chapter) => {
      const session = getChapterSessionState(chapter, tasks, goldQa);
      if (session.key === 'NOT_STARTED') counts.notStarted += 1;
      if (session.key === 'IN_PROGRESS') counts.inProgress += 1;
      if (session.key === 'EXAM_READY') counts.exam += 1;
      if (session.key === 'INDEXED') counts.indexed += 1;
    });
    return counts;
  }, [chapters, goldQa, tasks]);
  const collection = useCollectionView(rows, {
    initialPageSize: 25,
    pageSizeOptions: [25, 50, 100],
  });

  const closePreview = () => {
    setSelectedChapter(null);
    onClosePreview?.();
  };

  const openPreview = (chapter) => {
    setSelectedChapter(chapter);
    onOpenPreview?.(chapter);
  };

  const openPdf = (chapter, previewOverride) => {
    const target = getChapterPdfOpenTarget(chapter, previewOverride);
    if (!target) return;
    onOpenMaterial?.(target.source, {
      pageStart: target.pageStart,
      pageEnd: target.pageEnd,
    });
  };

  const startChapter = async (chapter) => {
    if (!chapter?.title) return;
    await onStartChapter?.(chapter.title);
  };

  const ignoreChapter = (chapter, anchorRect) => {
    if (!chapter) return;
    confirmDanger({
      title: 'Xóa mục này khỏi mục lục?',
      content: 'Mục sẽ biến khỏi danh sách huấn luyện. File PDF gốc vẫn giữ nguyên.',
      okText: 'Xóa khỏi mục lục',
      cancelText: 'Hủy',
      anchorRect,
      onOk: async () => {
        const result = await onIgnoreChapter?.(chapter);
        if (result && (selectedChapter?.chapterKey || selectedChapter?.id)
          === (chapter.chapterKey || chapter.id)) {
          closePreview();
        }
      },
    });
  };

  return (
    <section className="expert-training__section" aria-labelledby="chapter-coverage-heading">
      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Senior bắt đầu chương train"
          description="Giảng viên nhận việc Q&A vàng sau khi Senior bấm Bắt đầu chương."
        />
      )}

      {(!loading || chapters.length > 0) && (
        <MetricStrip
          ariaLabel="Tiến độ huấn luyện theo chương"
          items={[
            { key: 'total', label: 'Chương', value: summary.total, description: 'Trong mục lục đã index' },
            { key: 'idle', label: 'Chưa train', value: summary.notStarted, description: 'Chưa giao Teacher' },
            { key: 'exam', label: 'Bài thi', value: summary.exam, description: 'Chờ Senior xem điểm' },
            { key: 'rag', label: 'Đã nạp RAG', value: summary.indexed, description: 'Q&A vàng đã vào brain' },
          ]}
        />
      )}

      <div className="expert-training__toc-shell">
        <div className="expert-training__toc-toolbar">
          <div>
            <h2 id="chapter-coverage-heading">Mục lục giáo trình</h2>
            <p>Chọn chương đã embed, giao Teacher viết Q&A vàng. Tài liệu URL sẽ tách từng mục website.</p>
          </div>
          <div className="expert-training__toc-toolbar-actions">
            {canReview && (
              <Button
                icon={<RefreshCw size={15} />}
                loading={Boolean(pendingAction) || loading}
                disabled={Boolean(pendingAction)}
                onClick={() => {
                  if (onForceRefresh) onForceRefresh();
                  else onRefresh?.();
                }}
              >
                Làm mới mục lục
              </Button>
            )}
            <Input
              allowClear
              prefix={<Search size={15} aria-hidden="true" />}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm chương..."
              className="expert-training__chapter-search"
            />
          </div>
        </div>

        <Segmented
          className="expert-training__toc-filters"
          value={sessionFilter}
          onChange={setSessionFilter}
          options={SESSION_FILTERS.map((item) => ({
            ...item,
            label: item.value === 'ALL' ? `${item.label} (${summary.total})` : item.label,
          }))}
        />

        <AsyncState
          loading={loading && !chapters.length}
          error={error}
          empty={!loading && !error && !rows.length}
          emptyTitle={keyword || sessionFilter !== 'ALL' ? 'Không tìm thấy chương' : 'Chưa có mục lục tài liệu'}
          emptyDescription={keyword || sessionFilter !== 'ALL'
            ? 'Đổi bộ lọc hoặc từ khóa.'
            : 'Upload và index giáo trình trước, rồi ấn làm mới.'}
          onRetry={onRefresh}
        >
          <div className="expert-training__chapter-session-list" role="list">
            {collection.visibleItems.map(({ chapter, index, session }) => {
              const canStart = canReview
                && session.key === 'NOT_STARTED'
                && Number(chapter.chunkCount) > 0;
              const depth = Math.min(Math.max(Number(chapter.tocLevel) || 0, 0), 3);
              const marker = chapterMarker(chapter, index);
              const pdfTarget = getChapterPdfOpenTarget(chapter);
              const chapterKey = chapter.chapterKey || chapter.id;
              return (
                <article
                  key={chapterKey}
                  role="listitem"
                  className={`expert-training__chapter-session-row expert-training__chapter-session-row--depth-${depth}`}
                  style={{ '--toc-depth': depth }}
                >
                  <button
                    type="button"
                    className="expert-training__chapter-session-copy"
                    onClick={() => openPreview(chapter)}
                  >
                    <span className="expert-training__chapter-marker" aria-hidden="true">
                      {marker || <BookOpen size={14} />}
                    </span>
                    <div>
                      <strong>{chapter.title}</strong>
                      <span>{formatChapterPages(chapter)}</span>
                    </div>
                  </button>
                  <div className="expert-training__chapter-session-actions">
                    <Tag color={session.color}>{session.label}</Tag>
                    {pdfTarget && (
                      <Tooltip title="Mở đúng trang PDF">
                        <Button
                          icon={<FileSearch size={15} />}
                          aria-label={`Mở PDF ${chapter.title}`}
                          onClick={() => openPdf(chapter)}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="Xem trang sách">
                      <Button
                        icon={<Eye size={15} />}
                        aria-label={`Xem trang sách ${chapter.title}`}
                        onClick={() => openPreview(chapter)}
                      />
                    </Tooltip>
                    {canReview && (
                      <Tooltip title="Xóa mục nhiễu khỏi mục lục">
                        <Button
                          danger
                          icon={<Trash2 size={15} />}
                          aria-label={`Xóa khỏi mục lục ${chapter.title}`}
                          disabled={Boolean(pendingAction)}
                          loading={pendingAction === `ignore-chapter:${chapterKey}`}
                          onClick={(event) => ignoreChapter(chapter, event.currentTarget.getBoundingClientRect())}
                        />
                      </Tooltip>
                    )}
                    {session.key === 'EXAM_READY' && canReview && (
                      <Button type="primary" ghost onClick={() => onOpenExam?.(chapter.title)}>
                        Xem bài thi
                      </Button>
                    )}
                    {canReview && (
                      <Button
                        type="primary"
                        icon={<Play size={15} />}
                        disabled={!canStart || Boolean(pendingAction)}
                        loading={pendingAction === `start-chapter:${chapter.title}`}
                        onClick={() => startChapter(chapter)}
                      >
                        Bắt đầu chương
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </AsyncState>
        <CollectionPagination collection={collection} />
      </div>

      <ChapterPreviewDrawer
        key={selectedChapter?.chapterKey || selectedChapter?.id || 'closed-chapter-preview'}
        courseId={courseId}
        chapter={selectedChapter}
        preview={chapterPreview}
        previewLoading={chapterPreviewLoading}
        previewError={chapterPreviewError}
        canReview={canReview}
        pendingAction={pendingAction}
        session={selectedChapter ? getChapterSessionState(selectedChapter, tasks, goldQa) : null}
        onClose={closePreview}
        onStartChapter={startChapter}
        onOpenMaterial={onOpenMaterial}
        onIgnoreChapter={(chapter) => ignoreChapter(chapter)}
      />
    </section>
  );
}
