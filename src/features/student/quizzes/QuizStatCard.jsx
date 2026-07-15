import { memo } from 'react';

function QuizStatCard({ icon, label, value, description, tone = 'neutral' }) {
  return (
    <div className={`quiz-stat-card quiz-stat-card--${tone}`}>
      <div className="quiz-stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {description && <small>{description}</small>}
      </div>
    </div>
  );
}

export default memo(QuizStatCard);
