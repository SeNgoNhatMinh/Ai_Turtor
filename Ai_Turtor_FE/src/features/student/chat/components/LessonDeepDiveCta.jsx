import { Sparkles } from 'lucide-react';
import { buildDeepDiveListPrompt } from '../../learning/studySuggestionPrompt';

function LessonDeepDiveCta({ question, answer, onStudy }) {
  const prompt = buildDeepDiveListPrompt(question, answer);
  if (!prompt || !onStudy) return null;

  return (
    <section className="answer-improve-suggestions" aria-label="Học chuyên sâu bài vừa chọn">
      <div className="answer-improve-suggestions__header">
        <strong>Học chuyên sâu</strong>
        <span>
          Muốn đào sâu bài vừa học? AI sẽ gợi ý thêm hướng từ tài liệu.
          Nếu đã hiểu, chọn Bài tiếp theo ở trên.
        </span>
      </div>
      <div className="answer-improve-suggestions__list">
        <article className="answer-improve-suggestion">
          <span>Gợi ý các khía cạnh sâu hơn của bài này, chưa nhảy sang bài kế.</span>
          <div className="answer-improve-suggestion__actions">
            <button
              type="button"
              onClick={() => onStudy({ text: prompt })}
            >
              <Sparkles size={14} aria-hidden="true" /> Học chuyên sâu bài này
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

export default LessonDeepDiveCta;
