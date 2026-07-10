import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

let activeConfirm = null;

export const closeActiveConfirm = () => {
  if (!activeConfirm) return;
  const { root, container } = activeConfirm;
  root.unmount();
  container.remove();
  activeConfirm = null;
};

function ConfirmCard({
  title,
  content,
  okText,
  cancelText,
  danger = false,
  onOk,
  anchorRect,
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeActiveConfirm();
    };
    const onLayoutChange = () => closeActiveConfirm();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('scroll', onLayoutChange, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('scroll', onLayoutChange, true);
    };
  }, []);

  const confirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onOk?.();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      closeActiveConfirm();
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
    <div className="app-confirm-overlay" onClick={closeActiveConfirm}>
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
          <button type="button" className="app-confirm-card__btn" onClick={closeActiveConfirm} disabled={loading}>
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

const openConfirm = ({
  title,
  content,
  okText,
  cancelText,
  onOk,
  danger = false,
  anchorRect,
}) => {
  closeActiveConfirm();
  const container = document.createElement('div');
  container.className = 'app-confirm-host';
  document.body.appendChild(container);
  const root = createRoot(container);
  activeConfirm = { root, container };
  root.render(
    <ConfirmCard
      title={title}
      content={content}
      okText={okText}
      cancelText={cancelText}
      danger={danger}
      onOk={onOk}
      anchorRect={anchorRect}
    />,
  );
};

export const confirmDanger = ({
  title = 'Delete item?',
  content = 'This action cannot be undone.',
  okText = 'Delete',
  cancelText = 'Cancel',
  onOk,
  anchorRect,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: true,
  onOk,
  anchorRect,
});

export const confirmAction = ({
  title = 'Confirm action?',
  content = 'Please confirm before continuing.',
  okText = 'Confirm',
  cancelText = 'Cancel',
  onOk,
  anchorRect,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: false,
  onOk,
  anchorRect,
});
