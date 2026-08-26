import {
  BookOpenText,
  CircleAlert,
  CircleCheck,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import AiAnswer from '../../../../components/AiAnswer';
import { formatTeacherGoldAnswer } from '../../../../utils/teacherGoldAnswerFormat';
import { formatPercent } from '../../expertTrainingUtils';

function AnswerComparisonCard({ role, name, hint, icon, children }) {
  return (
    <article className={`expert-exam-compare-card expert-exam-compare-card--${role}`}>
      <header>
        <span className={`expert-exam-chat__avatar expert-exam-chat__avatar--${role}`} aria-hidden="true">{icon}</span>
        <div><strong>{name}</strong><span>{hint}</span></div>
      </header>
      <div className="expert-exam-chat__body">{children}</div>
    </article>
  );
}

function ExamMetric({ label, value, tone = '' }) {
  return (
    <div className={`expert-exam-metric ${tone ? `expert-exam-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function GoldQaExamCompare({ contribution }) {
  if (!contribution) return null;

  const teacherAnswer = formatTeacherGoldAnswer(contribution.goldAnswer) || 'Chưa có tóm tắt theo giáo trình.';
  const aiAnswer = contribution.examAiAnswer || contribution.examError || 'Chưa chấm được.';

  return (
    <div className="expert-exam-chat">
      <div className="expert-exam-question">
        <BookOpenText size={17} />
        <div><span>Câu hỏi kiểm tra</span><strong>{contribution.question || 'Chưa có câu hỏi.'}</strong></div>
      </div>

      <div className="expert-exam-comparison-grid">
        <AnswerComparisonCard
          role="teacher"
          name="Tóm tắt theo giáo trình"
          hint="Teacher biên tập từ sách — không phải đáp án thay sách"
          icon={<GraduationCap size={16} />}
        >
          <AiAnswer markdown={teacherAnswer} hideSourceSection />
        </AnswerComparisonCard>

        <AnswerComparisonCard
          role="ai"
          name="Câu trả lời AI (xem trước)"
          hint="Như khi SV hỏi sau training — chưa nạp RAG thật"
          icon={<Sparkles size={16} />}
        >
          <AiAnswer markdown={aiAnswer} hideSourceSection />
        </AnswerComparisonCard>
      </div>

      <footer className="expert-exam-metrics">
        <ExamMetric
          label="Điểm bài thi"
          value={contribution.examScore == null ? '—' : formatPercent(contribution.examScore)}
          tone={contribution.examPassed ? 'success' : 'warning'}
        />
        <ExamMetric
          label="RAG confidence"
          value={contribution.examRagConfidence == null ? '—' : formatPercent(contribution.examRagConfidence)}
        />
        <div className={`expert-exam-metric expert-exam-metric--${contribution.examHallucinated ? 'danger' : 'success'}`}>
          <span>Kiểm tra bịa nội dung</span>
          <strong>
            {contribution.examHallucinated ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
            {contribution.examHallucinated ? 'Có nguy cơ' : 'Không phát hiện'}
          </strong>
        </div>
      </footer>
    </div>
  );
}
