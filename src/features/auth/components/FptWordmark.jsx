function FptWordmark({ className = '' }) {
  return (
    <span className={`fpt-logo-wordmark ${className}`.trim()} aria-label="FPT">
      <img
        src="/fpt-logo.svg"
        alt=""
        width="34"
        height="21"
        decoding="async"
        aria-hidden="true"
      />
    </span>
  );
}

export default FptWordmark;
