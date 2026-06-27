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
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeActiveConfirm();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  return (
    <div className="app-confirm-overlay" onClick={closeActiveConfirm}>
      <div
        className={`app-confirm-card ${danger ? 'app-confirm-card--danger' : ''}`}
        role="dialog"
        aria-modal="true"
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
    />,
  );
};

export const confirmDanger = ({
  title = 'Delete item?',
  content = 'This action cannot be undone.',
  okText = 'Delete',
  cancelText = 'Cancel',
  onOk,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: true,
  onOk,
});

export const confirmAction = ({
  title = 'Confirm action?',
  content = 'Please confirm before continuing.',
  okText = 'Confirm',
  cancelText = 'Cancel',
  onOk,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: false,
  onOk,
});
