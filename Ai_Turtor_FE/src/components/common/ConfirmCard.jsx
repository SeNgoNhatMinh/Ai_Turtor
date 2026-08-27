import { useEffect, useId, useRef, useState } from 'react';
import './ConfirmCard.css';

function ConfirmCard({
  title,
  content,
  okText,
  cancelText,
  danger = false,
  onOk,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const titleId = useId();
  const contentId = useId();
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'Tab') {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const confirm = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await onOk?.();
      if (result === false) {
        setLoading(false);
        return;
      }
      if (onClose) onClose();
      else setLoading(false);
    } catch (error) {
      console.error('Confirm action failed:', error);
      setErrorMessage(error?.userMessage || error?.message || 'Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div
      className="app-confirm-overlay"
      onClick={loading ? undefined : onClose}
    >
      <div
        className={`app-confirm-card ${danger ? 'app-confirm-card--danger' : ''}`}
        role={danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={content ? contentId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-confirm-card__body">
          <div className="app-confirm-card__title" id={titleId}>{title}</div>
          {content && <div className="app-confirm-card__content" id={contentId}>{content}</div>}
          {errorMessage && <div className="app-confirm-card__error" role="alert">{errorMessage}</div>}
        </div>
        <div className="app-confirm-card__actions">
          <button ref={cancelRef} type="button" className="app-confirm-card__btn" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="app-confirm-card__btn app-confirm-card__btn--primary"
            onClick={confirm}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : okText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCard;
