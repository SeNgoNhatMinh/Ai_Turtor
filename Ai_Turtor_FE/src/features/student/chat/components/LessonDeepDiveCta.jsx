import { Sparkles } from 'lucide-react';
import { buildDeepDiveListPrompt } from '../../learning/studySuggestionPrompt';

function LessonDeepDiveCta({ question, answer, onStudy, readOnly = false }) {
  const prompt = buildDeepDiveListPrompt(question, answer);
  if (!prompt || (!readOnly && !onStudy)) return null;

  return (
    <section className="answer-improve-suggestions" aria-label="Học chuyên sâu bài vừa chọn">
      <div className="answer-improve-suggestions__header">
        <strong>Học chuyên sâu</strong>
        <span>
          {readOnly
            ? 'Sinh viên thấy nút này sau bài học để xin các hướng đào sâu hơn, chưa nhảy sang bài kế.'
            : 'Muốn đào sâu bài vừa học? AI sẽ gợi ý thêm hướng từ tài liệu. Nếu đã hiểu, chọn Bài tiếp theo ở trên.'}
        </span>
      </div>
      <div className="answer-improve-suggestions__list">
        <article className="answer-improve-suggestion">
          <span>Gợi ý các khía cạnh sâu hơn của bài này, chưa nhảy sang bài kế.</span>
          {readOnly ? (
            <em className="answer-improve-suggestion__note">Sinh viên bấm “Học chuyên sâu bài này”</em>
          ) : (
            <div className="answer-improve-suggestion__actions">
              <button
                type="button"
                onClick={() => onStudy({ text: prompt })}
              >
                <Sparkles size={14} aria-hidden="true" /> Học chuyên sâu bài này
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export default LessonDeepDiveCta;
