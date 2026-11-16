import { BookOpenCheck } from 'lucide-react';

export default function RemediationRequestCard({
  title = 'Ôn lại câu vừa sai',
  question,
  status = 'Lượt ôn tập',
}) {
  return (
    <div className="remediation-request-card" role="status">
      <span className="remediation-request-card__icon" aria-hidden="true">
        <BookOpenCheck size={18} strokeWidth={2} />
      </span>
      <span className="remediation-request-card__content">
        <strong>{title}</strong>
        {question ? <span>{question}</span> : null}
      </span>
      {status ? <span className="remediation-request-card__status">{status}</span> : null}
    </div>
  );
}
