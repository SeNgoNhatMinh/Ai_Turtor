import { FileText, LifeBuoy, ShieldCheck, Sparkles } from 'lucide-react';
import { formatSourceItems } from '../../utils/sourceLabels';

const getAnswerType = (mode) => {
  if (mode === 'CODE' || mode === 'CODE_MENTOR') return 'Code Review';
  if (mode === 'ESCALATE') return 'Mentor Review';
  return 'Course AI';
};

const getConfidenceClass = (confidence) => {
  if (confidence == null) return 'unknown';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'medium';
  return 'low';
};

function AnswerEvidence({ message, sourceMap = {}, onDownloadSource }) {
  const sources = formatSourceItems(Array.isArray(message?.sources) ? message.sources : [], sourceMap);
  const confidenceClass = getConfidenceClass(message?.confidence);
  const confidenceText = message?.confidence == null ? 'Not available' : `${Math.round(message.confidence * 100)}%`;

  return (
    <div className="answer-evidence">
      <div className="answer-evidence-pill">
        <Sparkles size={14} aria-hidden="true" />
        <span>Answer type: {getAnswerType(message?.mode)}</span>
      </div>
      <div className={`answer-evidence-pill confidence-${confidenceClass}`}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Confidence: {confidenceText}</span>
      </div>
      {sources.length > 0 && (
        <div className="answer-evidence-sources">
          <FileText size={14} aria-hidden="true" />
          {sources.map((source, index) => {
            if (source.id && onDownloadSource) {
              return (
                <a
                  key={`${source.id}-${index}`}
                  className="source-link"
                  style={{ cursor: 'pointer', color: '#1677ff', textDecoration: 'underline' }}
                  onClick={() => onDownloadSource(source.id, source.label)}
                >
                  {source.label}
                </a>
              );
            }
            return <span key={`${source.label}-${index}`}>{source.label}</span>;
          })}
        </div>
      )}
      {message?.questionEscalationId && (
        <div className="answer-evidence-pill support-recorded">
          <LifeBuoy size={14} aria-hidden="true" />
          <span>Mentor review ticket: {message.questionEscalationId}</span>
        </div>
      )}
    </div>
  );
}

export default AnswerEvidence;
