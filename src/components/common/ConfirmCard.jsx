import { useEffect, useState } from 'react';

function ConfirmCard({
  title,
  content,
  okText,
  cancelText,
  danger = false,
  onOk,
  anchorRect,
  onClose,
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const onLayoutChange = () => onClose?.();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('scroll', onLayoutChange, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('scroll', onLayoutChange, true);
    };
  }, [onClose]);

  const confirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onOk?.();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      onClose?.();
    }
  };

  const getAnchoredStyle = () => {
    if (!anchorRect) return undefined;
    const margin = 12;
    const gap = 8;
    const estimatedHeight = 164;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const width = Math.min(320, viewportWidth - margin * 2);

    const left = Math.min(
      Math.max(margin, anchorRect.right - width),
      Math.max(margin, viewportWidth - width - margin),
    );

    const belowTop = anchorRect.bottom + gap;
    const aboveTop = anchorRect.top - estimatedHeight - gap;
    const hasRoomBelow = belowTop + estimatedHeight <= viewportHeight - margin;
    const hasRoomAbove = aboveTop >= margin;
    const top = hasRoomBelow
      ? belowTop
      : hasRoomAbove
        ? aboveTop
        : Math.min(
            Math.max(margin, belowTop),
            Math.max(margin, viewportHeight - estimatedHeight - margin),
          );

    return {
      left,
      top,
      right: 'auto',
      bottom: 'auto',
      width,
    };
  };

  return (
    <div className="app-confirm-overlay" onClick={onClose}>
      <div
        className={`app-confirm-card ${anchorRect ? 'app-confirm-card--anchored' : ''} ${danger ? 'app-confirm-card--danger' : ''}`}
        role="dialog"
        aria-modal="true"
        style={getAnchoredStyle()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-confirm-card__body">
          <div className="app-confirm-card__title">{title}</div>
          {content && <div className="app-confirm-card__content">{content}</div>}
        </div>
        <div className="app-confirm-card__actions">
          <button type="button" className="app-confirm-card__btn" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className="app-confirm-card__btn app-confirm-card__btn--primary"
            onClick={confirm}
            disabled={loading}
          >
            {loading ? 'Working...' : okText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCard;
