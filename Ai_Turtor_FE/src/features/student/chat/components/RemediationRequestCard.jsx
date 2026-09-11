import { BookOpenCheck } from 'lucide-react';

export default function RemediationRequestCard({ question }) {
  return (
    <div className="remediation-request-card" role="status">
      <span className="remediation-request-card__icon" aria-hidden="true">
        <BookOpenCheck size={18} strokeWidth={2} />
      </span>
      <span className="remediation-request-card__content">
        <strong>Ôn lại câu vừa sai</strong>
        {question ? <span>{question}</span> : null}
      </span>
      <span className="remediation-request-card__status">Lượt ôn tập</span>
    </div>
  );
}
