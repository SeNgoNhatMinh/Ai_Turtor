import { ChevronRight } from 'lucide-react';
import StatusLabel from './StatusLabel';
import './WorkflowUI.css';

export default function ActionQueue({ items = [], emptyText = 'Không có việc cần xử lý.' }) {
  if (!items.length) return <div className="action-queue__empty">{emptyText}</div>;

  return (
    <div className="action-queue">
      {items.map(({ key, title, description, status, icon: Icon, onClick, disabled }) => (
        <button
          key={key || title}
          type="button"
          className="action-queue__item"
          onClick={onClick}
          disabled={disabled || !onClick}
        >
          <span className="action-queue__icon" aria-hidden="true">
            {Icon ? <Icon size={17} /> : <ChevronRight size={17} />}
          </span>
          <span className="action-queue__copy">
            <strong>{title}</strong>
            {description && <span>{description}</span>}
          </span>
          {status ? <StatusLabel status={status} /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
