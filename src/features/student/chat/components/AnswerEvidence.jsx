import { useState } from 'react';
import { ChevronDown, FileText, LifeBuoy, ShieldCheck, Sparkles } from 'lucide-react';
import { formatSourceItems } from '../../../../utils/sourceLabels';
import AuthenticatedEvidenceImage from './AuthenticatedEvidenceImage';

const getAnswerType = (mode) => {
  if (mode === 'CODE' || mode === 'CODE_MENTOR') return 'Xem xét mã nguồn';
  if (mode === 'ESCALATE') return 'Mentor xem xét';
  return 'AI theo môn học';
};

const getConfidenceClass = (confidence) => {
  if (confidence == null) return 'unknown';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'medium';
  return 'low';
};

function AnswerEvidence({ message, sourceMap = {}, onDownloadSource }) {
  const [expanded, setExpanded] = useState(false);
  const sources = formatSourceItems(Array.isArray(message?.sources) ? message.sources : [], sourceMap);
  const confidenceClass = getConfidenceClass(message?.confidence);
  const confidenceText = message?.confidence == null ? 'Chưa xác định' : `${Math.round(message.confidence * 100)}%`;
  const grounding = message?.groundingType || (sources.length > 0 ? 'COURSE_MATERIAL' : 'AI_GENERAL_KNOWLEDGE');
  const groundingLabel = grounding === 'COURSE_MATERIAL' ? 'Nguồn: Tài liệu khóa học' : 'Nguồn: Kiến thức AI chung';
  const isCodeMode = message?.mode === 'CODE' || message?.mode === 'CODE_MENTOR';
  const evidence = Array.isArray(message?.sourceEvidence) ? message.sourceEvidence : [];
  const hasEvidence = sources.length > 0 || evidence.length > 0 || isCodeMode || message?.questionEscalationId;

  if (!hasEvidence) return null;

  return (
    <div className="answer-evidence">
      <button
        type="button"
        className={`answer-evidence-toggle${expanded ? ' is-expanded' : ''}`}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <FileText size={15} aria-hidden="true" />
        <span>{expanded ? 'Ẩn nguồn tài liệu' : 'Xem nguồn tài liệu'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {expanded && <div className="answer-evidence-content">
      <div className="answer-evidence-pill">
        <Sparkles size={14} aria-hidden="true" />
        <span>Loại câu trả lời: {getAnswerType(message?.mode)}</span>
      </div>
      <div className={`answer-evidence-pill grounding-${String(grounding).toLowerCase()}`}>
        <FileText size={14} aria-hidden="true" />
        <span>{groundingLabel}</span>
      </div>
      <div className={`answer-evidence-pill confidence-${confidenceClass}`}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Độ tin cậy: {confidenceText}</span>
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
      {evidence.length > 0 && (
        <div className="answer-evidence-details" aria-label="Bằng chứng từ tài liệu môn học">
          {evidence.map((item, index) => (
            <div className="answer-evidence-detail" key={`${item.materialId || item.materialTitle}-${index}`}>
              <strong>{item.courseName || item.courseId || 'Môn học'}</strong>
              <span>{item.materialTitle || item.materialId || 'Tài liệu môn học'}</span>
              {item.chapter && <span>Chương/phần: {item.chapter}</span>}
              {item.pageStart != null && (
                <span>
                  Trang {item.pageStart}{item.pageEnd && item.pageEnd !== item.pageStart ? `–${item.pageEnd}` : ''}
                  {item.pageEstimated ? ' (ước tính)' : ''}
                </span>
              )}
              {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
              {Array.isArray(item.visualEvidence) && item.visualEvidence.length > 0 && (
                <div className="visual-evidence-grid" aria-label="Hình minh họa trích từ tài liệu">
                  {item.visualEvidence.map((visual, visualIndex) => (
                    <AuthenticatedEvidenceImage
                      key={`${visual.imageUrl || visual.pageNumber}-${visualIndex}`}
                      evidence={visual}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {isCodeMode && (
        <div className="answer-evidence-pill code-disclaimer">
          <FileText size={14} aria-hidden="true" />
          <span>Lưu ý: Câu trả lời mã được sinh bởi AI (không phải nội dung khóa học).</span>
        </div>
      )}
      {message?.questionEscalationId && (
        <div className="answer-evidence-pill support-recorded">
          <LifeBuoy size={14} aria-hidden="true" />
          <span>Đã gửi yêu cầu mentor xem xét</span>
        </div>
      )}
      </div>}
    </div>
  );
}

export default AnswerEvidence;
