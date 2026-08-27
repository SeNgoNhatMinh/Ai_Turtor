import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Skeleton, Space } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { materialsApi } from '../../../services/materialsApi';
import { getUserFacingError } from '../../../services/httpClient';

const MAX_CACHED_PAGES = 24;
const pageBlobCache = new Map();

const pageCacheKey = (courseId, materialId, page) => `${courseId}:${materialId}:${page}`;

async function loadPageBlob(courseId, materialId, page) {
  const key = pageCacheKey(courseId, materialId, page);
  const cached = pageBlobCache.get(key);
  if (cached) {
    pageBlobCache.delete(key);
    pageBlobCache.set(key, cached);
    return cached;
  }
  const blob = await materialsApi.getMaterialPageImage(courseId, materialId, page);
  pageBlobCache.set(key, blob);
  while (pageBlobCache.size > MAX_CACHED_PAGES) {
    const oldest = pageBlobCache.keys().next().value;
    pageBlobCache.delete(oldest);
  }
  return blob;
}

export default function ChapterPageViewer({
  courseId,
  materialId,
  pageStart,
  pageEnd,
  title = 'Trang sách',
}) {
  const start = Number(pageStart);
  const end = Math.max(start, Number(pageEnd) || start);
  const canRender = Boolean(courseId && materialId && Number.isFinite(start) && start > 0);

  if (!canRender) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Mục lục chưa gắn số trang PDF nên chưa xem được trang sách."
      />
    );
  }

  return (
    <ChapterPageViewerContent
      key={`${courseId}:${materialId}:${start}:${end}`}
      courseId={courseId}
      materialId={materialId}
      start={start}
      end={end}
      title={title}
    />
  );
}

function ChapterPageViewerContent({ courseId, materialId, start, end, title }) {
  const [page, setPage] = useState(start);
  const [loadState, setLoadState] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const objectUrlRef = useRef('');
  const requestKey = `${courseId}:${materialId}:${page}:${retryNonce}`;
  const currentLoadState = loadState?.key === requestKey
    ? loadState
    : { src: '', loading: true, error: '' };
  const { src, loading, error } = currentLoadState;

  useEffect(() => {
    let cancelled = false;
    loadPageBlob(courseId, materialId, page)
      .then((blob) => {
        if (cancelled) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const nextUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextUrl;
        setLoadState({ key: requestKey, src: nextUrl, loading: false, error: '' });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setLoadState({
          key: requestKey,
          src: '',
          loading: false,
          error: getUserFacingError(loadError, 'Không thể render trang sách. Thử lại hoặc mở PDF.'),
        });
      });

    const neighbor = page < end ? page + 1 : page > start ? page - 1 : 0;
    if (neighbor) {
      loadPageBlob(courseId, materialId, neighbor).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [courseId, end, materialId, page, requestKey, start]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight' && page < end) setPage((current) => Math.min(end, current + 1));
      if (event.key === 'ArrowLeft' && page > start) setPage((current) => Math.max(start, current - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [end, page, start]);

  const rangeLabel = useMemo(() => (
    start === end ? `Trang ${start}` : `Trang ${page} / ${start}–${end}`
  ), [end, page, start]);

  return (
    <section className="expert-training__page-viewer" aria-label={`Trang sách ${title}`}>
      <div className="expert-training__page-viewer-toolbar">
        <strong>{rangeLabel}</strong>
        <Space>
          <Button
            icon={<ChevronLeft size={16} />}
            aria-label="Trang trước"
            disabled={page <= start || loading}
            onClick={() => setPage((current) => Math.max(start, current - 1))}
          />
          <Button
            icon={<ChevronRight size={16} />}
            aria-label="Trang sau"
            disabled={page >= end || loading}
            onClick={() => setPage((current) => Math.min(end, current + 1))}
          />
        </Space>
      </div>

      {error ? (
        <Alert
          type="error"
          showIcon
          title="Không tải được trang sách"
          description={error}
          action={(
            <Button size="small" onClick={() => setRetryNonce((current) => current + 1)}>
              Thử lại
            </Button>
          )}
        />
      ) : loading && !src ? (
        <div className="expert-training__page-viewer-frame">
          <Skeleton.Image active className="expert-training__page-viewer-skeleton" />
          <p>Đang render trang sách… lần đầu có thể mất vài giây.</p>
        </div>
      ) : (
        <div className="expert-training__page-viewer-frame">
          {src && (
            <img
              src={src}
              alt={`${title} · Trang ${page}`}
              className="expert-training__page-viewer-image"
            />
          )}
          {loading && <div className="expert-training__page-viewer-busy">Đang tải trang {page}…</div>}
        </div>
      )}
    </section>
  );
}
