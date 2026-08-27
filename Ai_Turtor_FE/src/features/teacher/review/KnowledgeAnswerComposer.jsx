import { Input } from 'antd';
import { KNOWLEDGE_ANSWER_MAX_LENGTH } from '../../../constants/knowledgeAnswer';
import './KnowledgeAnswerComposer.css';

export default function KnowledgeAnswerComposer({
  id,
  label,
  value = '',
  onChange,
  disabled = false,
  required = false,
  rows = 8,
  placeholder = 'Viết câu trả lời học thuật đầy đủ.',
  helper = 'Tối đa 20.000 ký tự.',
}) {
  return (
    <div className="knowledge-answer-composer">
      {label ? (
        <label className="knowledge-answer-composer__label" htmlFor={id}>
          {label}
          {required ? <em>Bắt buộc</em> : null}
        </label>
      ) : null}
      <Input.TextArea
        id={id}
        aria-label={label}
        value={value}
        rows={rows}
        maxLength={KNOWLEDGE_ANSWER_MAX_LENGTH}
        showCount
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {helper ? (
        <div className="knowledge-answer-composer__toolbar">
          <span>{helper}</span>
        </div>
      ) : null}
    </div>
  );
}
