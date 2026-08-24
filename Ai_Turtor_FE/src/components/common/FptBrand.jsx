import './FptBrand.css';

function FptLogo({ className = '', label = 'FPT' }) {
  return (
    <span
      className={`fpt-brand__mark ${className}`.trim()}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <img
        src="/fpt-logo.svg"
        alt=""
        width="68"
        height="42"
        decoding="async"
        aria-hidden="true"
      />
    </span>
  );
}

export default function FptBrand({ className = '', compact = false }) {
  return (
    <span
      className={`fpt-brand ${compact ? 'fpt-brand--compact' : ''} ${className}`.trim()}
      role="img"
      aria-label="FPT University AI Tutor"
    >
      <FptLogo label="" />
      <span className="fpt-brand__copy" aria-hidden="true">
        <strong>University</strong>
        <small>AI Tutor</small>
      </span>
    </span>
  );
}
