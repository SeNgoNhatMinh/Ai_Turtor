import { CheckCircle } from 'lucide-react';

function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="toast-notification" role="status" aria-live="polite">
      <CheckCircle className="toast-icon" aria-hidden="true" />
      <span className="toast-text">{message}</span>
    </div>
  );
}

export default Toast;
