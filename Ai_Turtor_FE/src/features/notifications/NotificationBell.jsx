import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './useNotifications';
import { resolveNotificationPath } from './notificationModel';
import './NotificationBell.css';

function formatNotificationTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function placeNotificationLayer(anchor) {
  const rect = anchor?.getBoundingClientRect();
  if (!rect) return null;
  const width = Math.min(340, window.innerWidth - 16);
  let right = Math.max(8, window.innerWidth - rect.right);
  if (window.innerWidth - right - width < 8) {
    right = Math.max(8, window.innerWidth - width - 8);
  }
  return {
    top: rect.bottom + 8,
    right,
    width,
    maxHeight: Math.max(180, Math.min(420, window.innerHeight - rect.bottom - 16)),
  };
}

export default function NotificationBell({ userId, accountRole = '', isDarkMode = false }) {
  const navigate = useNavigate();
  const panelId = useId();
  const rootRef = useRef(null);
  const layerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [arrival, setArrival] = useState(null);
  const [layerStyle, setLayerStyle] = useState(null);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, {
    onArrived: setArrival,
  });

  useEffect(() => {
    if (!arrival) return undefined;
    const timer = window.setTimeout(() => setArrival(null), 8000);
    return () => window.clearTimeout(timer);
  }, [arrival]);

  const layerOpen = open || Boolean(arrival);
  useEffect(() => {
    if (!layerOpen) return undefined;
    const update = () => setLayerStyle(placeNotificationLayer(rootRef.current));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [layerOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || layerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = async (item) => {
    setOpen(false);
    setArrival(null);
    if (item?.unread) {
      try {
        await markRead(item.id);
      } catch {
        // The ticket still opens if marking read fails; the badge refreshes on the next load.
      }
    }
    const path = resolveNotificationPath(item, accountRole);
    if (path) navigate(path);
  };

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const label = unreadCount
    ? `Thông báo, ${unreadCount} chưa đọc`
    : 'Thông báo';

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell__trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-bell__badge">{badge}</span>}
      </button>
      <span className="notification-bell__live" aria-live="polite">
        {arrival ? `${arrival.title}. ${arrival.body}` : ''}
      </span>
      {layerOpen && layerStyle && createPortal(
        <div
          ref={layerRef}
          className={`notification-layer${isDarkMode ? ' notification-layer--dark' : ''}`}
          style={{ top: layerStyle.top, right: layerStyle.right, width: layerStyle.width }}
        >
          {arrival && !open && (
            <button
              type="button"
              className="notification-toast"
              onClick={() => openNotification(arrival)}
            >
              <strong>{arrival.title}</strong>
              <span>{arrival.body}</span>
            </button>
          )}
          {open && (
            <div
              className="notification-panel"
              id={panelId}
              role="dialog"
              aria-label="Thông báo"
              style={{ maxHeight: layerStyle.maxHeight }}
            >
              <header className="notification-panel__header">
                <strong>Thông báo</strong>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead}>Đánh dấu đã đọc</button>
                )}
              </header>
              {notifications.length === 0 ? (
                <p className="notification-panel__empty">Chưa có thông báo.</p>
              ) : (
                <ul>
                  {notifications.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={item.unread ? 'is-unread' : ''}
                        onClick={() => openNotification(item)}
                      >
                        <strong>{item.title}</strong>
                        {item.body && <span>{item.body}</span>}
                        {item.createdAt && <small>{formatNotificationTime(item.createdAt)}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
