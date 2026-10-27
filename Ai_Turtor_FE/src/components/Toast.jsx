import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function Toast({ message, type = 'success' }) {
  if (!message) return null;

  const text = typeof message === 'string' ? message : message.text || message.message || '';
  const resolvedType = (typeof message === 'object' && message.type) || type;
  const Icon = ICON_MAP[resolvedType] || CheckCircle;

  if (!text) return null;

  return (
    <div className={`toast-notification toast-notification--${resolvedType}`} role="status" aria-live="polite">
      <Icon className="toast-icon" aria-hidden="true" />
      <span className="toast-text">{text}</span>
    </div>
  );
}

export default Toast;
