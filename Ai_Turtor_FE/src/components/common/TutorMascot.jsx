import './TutorMascot.css';

function TutorMascot({
  alt = 'Linh vật AI Tutor',
  className = '',
  size = 'md',
}) {
  return (
    <span className={`tutor-mascot tutor-mascot--${size} ${className}`.trim()}>
      <img
        src="/mascot.png"
        alt={alt}
        width="1024"
        height="1024"
        decoding="async"
      />
    </span>
  );
}

export default TutorMascot;
