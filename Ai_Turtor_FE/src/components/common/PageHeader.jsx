import { memo, useId } from 'react';

function PageHeader({ title, description, eyebrow, actions, className = '' }) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <header
      className={`page-header ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="page-header__copy">
        {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
        <h1 id={titleId} className="page-title">{title}</h1>
        {description && <p id={descriptionId} className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export default memo(PageHeader);
