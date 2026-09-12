import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Skeleton, Space } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { queryKeys } from '../../../app/queryKeys';
import { materialsApi } from '../../../services/materialsApi';
import { getUserFacingError } from '../../../services/httpClient';

const PAGE_IMAGE_CACHE_TIME = 5 * 60_000;

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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(start);
  const [src, setSrc] = useState('');
  const pageQuery = useQuery({
    queryKey: queryKeys.materialPageImage(courseId, materialId, page),
    queryFn: ({ signal }) => materialsApi.getMaterialPageImage(
      courseId,
      materialId,
      page,
      { signal },
    ),
    staleTime: Infinity,
    gcTime: PAGE_IMAGE_CACHE_TIME,
    retry: 1,
  });
  const loading = pageQuery.isPending || pageQuery.isFetching;
  const error = pageQuery.error
    ? getUserFacingError(pageQuery.error, 'Không thể render trang sách. Thử lại hoặc mở PDF.')
    : '';

  useEffect(() => {
    if (!pageQuery.data) return undefined;
    const objectUrl = URL.createObjectURL(pageQuery.data);
    let active = true;
    queueMicrotask(() => {
      if (active) setSrc(objectUrl);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [pageQuery.data]);

  useEffect(() => {
    const neighbor = page < end ? page + 1 : page > start ? page - 1 : 0;
    if (!neighbor) return;
    queryClient.prefetchQuery({
      queryKey: queryKeys.materialPageImage(courseId, materialId, neighbor),
      queryFn: ({ signal }) => materialsApi.getMaterialPageImage(
        courseId,
        materialId,
        neighbor,
        { signal },
      ),
      staleTime: Infinity,
      gcTime: PAGE_IMAGE_CACHE_TIME,
    });
  }, [courseId, end, materialId, page, queryClient, start]);

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
            <Button size="small" onClick={() => pageQuery.refetch()} loading={pageQuery.isFetching}>
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
