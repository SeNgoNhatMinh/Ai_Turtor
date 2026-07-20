import { Alert, Button, Empty, Skeleton } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import './AsyncState.css';

function AsyncState({
  loading = false,
  error = '',
  empty = false,
  loadingRows = 4,
  loadingLabel = 'Đang tải nội dung...',
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription = '',
  onRetry,
  compact = false,
  children,
}) {
  if (loading) {
    return (
      <div className={`async-state async-state--loading ${compact ? 'async-state--compact' : ''}`} role="status" aria-live="polite">
        <span className="sr-only">{loadingLabel}</span>
        <Skeleton active paragraph={{ rows: loadingRows }} title />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`async-state ${compact ? 'async-state--compact' : ''}`}>
        <Alert
          type="warning"
          showIcon
          title="Không thể tải nội dung"
          description={error}
          action={onRetry ? (
            <Button size="small" icon={<ReloadOutlined />} aria-label="Thử lại" onClick={onRetry}>Thử lại</Button>
          ) : null}
        />
      </div>
    );
  }

  if (empty) {
    return (
      <div className={`async-state ${compact ? 'async-state--compact' : ''}`} role="status">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={(
            <div className="async-state__empty-copy">
              <strong>{emptyTitle}</strong>
              {emptyDescription && <span>{emptyDescription}</span>}
            </div>
          )}
        />
      </div>
    );
  }

  return children;
}

export default AsyncState;
