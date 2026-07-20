import './WorkflowUI.css';

export default function MetricStrip({ items = [], ariaLabel = 'Chỉ số tổng quan' }) {
  if (!items.length) return null;

  return (
    <section
      className="metric-strip"
      aria-label={ariaLabel}
      style={{ '--metric-columns': Math.min(items.length, 4) }}
    >
      {items.map(({ key, label, value, description, icon: Icon }) => (
        <article className="metric-strip__item" key={key || label}>
          <div>
            <span className="metric-strip__label">{label}</span>
            <strong className="metric-strip__value">{value}</strong>
          </div>
          {Icon && <span className="metric-strip__icon" aria-hidden="true"><Icon size={18} /></span>}
          {description && <span className="metric-strip__description">{description}</span>}
        </article>
      ))}
    </section>
  );
}
