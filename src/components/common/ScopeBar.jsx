import './WorkflowUI.css';

export default function ScopeBar({ children, actions, className = '' }) {
  return (
    <div className={`scope-bar ${className}`.trim()}>
      <div className="scope-bar__context">{children}</div>
      {actions && <div className="scope-bar__actions">{actions}</div>}
    </div>
  );
}
