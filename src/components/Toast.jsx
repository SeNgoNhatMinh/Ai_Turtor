import { CheckCircle } from 'lucide-react';

function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="toast-notification">
      <CheckCircle className="toast-icon" />
      <span className="toast-text">{message}</span>
    </div>
  );
}

export default Toast;
