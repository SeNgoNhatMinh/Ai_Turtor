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

const normalizeEvidenceText = (value) => String(value || '')
  .normalize('NFKC')
  .toLocaleLowerCase('vi')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 320);

const mergeVisualEvidence = (current = [], incoming = []) => {
  const merged = new Map();
  [...current, ...incoming].forEach((visual) => {
    if (!visual) return;
    const key = visual.imageUrl || `${visual.documentUrl || ''}|${visual.pageNumber || ''}`;
    if (key && !merged.has(key)) merged.set(key, visual);
  });
  return [...merged.values()];
};

const deduplicateEvidence = (items = []) => {
  const merged = new Map();
  items.forEach((item) => {
    if (!item) return;
    const excerpt = normalizeEvidenceText(item.excerpt);
    const key = excerpt
      ? `${item.courseId || item.courseName || ''}|text:${excerpt}`
      : `${item.courseId || item.courseName || ''}|${item.materialId || item.materialTitle || ''}|${item.pageStart || ''}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      return;
    }
    const visuals = mergeVisualEvidence(existing.visualEvidence, item.visualEvidence);
    const preferred = visuals.length > 0 && (!existing.visualEvidence || existing.visualEvidence.length === 0)
      ? item
      : existing;
    merged.set(key, { ...preferred, visualEvidence: visuals });
  });
  return [...merged.values()];
};

function AnswerEvidence({ message, sourceMap = {}, onDownloadSource }) {
  const [expanded, setExpanded] = useState(false);
  const sources = formatSourceItems(Array.isArray(message?.sources) ? message.sources : [], sourceMap);
  const confidenceClass = getConfidenceClass(message?.confidence);
  const confidenceText = message?.confidence == null ? 'Chưa xác định' : `${Math.round(message.confidence * 100)}%`;
  const grounding = message?.groundingType || (sources.length > 0 ? 'COURSE_MATERIAL' : 'AI_GENERAL_KNOWLEDGE');
  const groundingLabel = grounding === 'COURSE_MATERIAL' ? 'Dựa trên tài liệu môn học' : 'AI tự phân tích bằng kiến thức chung';
  const isCodeMode = message?.mode === 'CODE' || message?.mode === 'CODE_MENTOR';
  const evidence = deduplicateEvidence(Array.isArray(message?.sourceEvidence) ? message.sourceEvidence : []);
  const hasEvidence = sources.length > 0 || evidence.length > 0 || isCodeMode || message?.questionEscalationId;
  const primaryEvidence = evidence[0] || null;
  const evidenceLocation = primaryEvidence
    ? [
        primaryEvidence.materialTitle,
        primaryEvidence.chapter,
        primaryEvidence.pageStart != null ? `Trang ${primaryEvidence.pageStart}` : null,
      ].filter(Boolean).join(' · ')
    : '';

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
        <span>{expanded
          ? 'Ẩn bằng chứng tài liệu'
          : evidence.length > 0
            ? `Bằng chứng tài liệu (${evidence.length})`
            : 'Xem nguồn tài liệu'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {!expanded && evidenceLocation && (
        <span className="answer-evidence-preview" title={evidenceLocation}>
          {evidenceLocation}
        </span>
      )}
      {expanded && <div className="answer-evidence-content">
      <div className="answer-evidence-pill">
        <Sparkles size={14} aria-hidden="true" />
        <span>{getAnswerType(message?.mode)}</span>
      </div>
      <div className={`answer-evidence-pill grounding-${String(grounding).toLowerCase()}`}>
        <FileText size={14} aria-hidden="true" />
        <span>{groundingLabel}</span>
      </div>
      <div className={`answer-evidence-pill confidence-${confidenceClass}`}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Mức độ phù hợp với tài liệu: {confidenceText}</span>
      </div>
      {sources.length > 0 && (
        <div className="answer-evidence-sources">
          <FileText size={14} aria-hidden="true" />
          {sources.map((source, index) => {
            if (source.id && onDownloadSource) {
              return (
                <button
                  type="button"
                  key={`${source.id}-${index}`}
                  className="source-link"
                  onClick={() => onDownloadSource(source.id, source.label)}
                >
                  {source.label}
                </button>
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
              <strong>Bằng chứng {index + 1}</strong>
              <span><b>Môn học:</b> {item.courseName || item.courseId || 'Chưa xác định'}</span>
              <span><b>Tài liệu:</b> {item.materialTitle || item.materialId || 'Chưa xác định'}</span>
              {item.chapter && <span><b>Chương/phần:</b> {item.chapter}</span>}
              {item.pageStart != null && (
                <span>
                  <b>Trang trích dẫn:</b> {item.pageStart}
                  {item.pageEnd && item.pageEnd !== item.pageStart ? `–${item.pageEnd}` : ''}
                  {item.pageEstimated ? ' · Trang được hệ thống ước tính' : ' · Trang xác định từ tài liệu'}
                </span>
              )}
              {item.excerpt && (
                <div className="answer-evidence-quote">
                  <b>Đoạn nội dung chứng minh:</b>
                  <blockquote>{item.excerpt}</blockquote>
                </div>
              )}
              {Array.isArray(item.visualEvidence) && item.visualEvidence.length > 0 && (
                <div className="visual-evidence-grid" aria-label="Ảnh của trang tài liệu được trích dẫn">
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
          <span>Câu trả lời này do AI tự phân tích bằng kiến thức lập trình chung, không trích từ tài liệu môn học.</span>
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
