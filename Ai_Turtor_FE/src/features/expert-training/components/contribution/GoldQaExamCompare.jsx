import { Tag } from 'antd';
import { GraduationCap, Sparkles } from 'lucide-react';
import AiAnswer from '../../../../components/AiAnswer';
import { formatTeacherGoldAnswer } from '../../../../utils/teacherGoldAnswerFormat';
import { formatPercent } from '../../expertTrainingUtils';

function ExamChatTurn({ role, name, hint, children }) {
  return (
    <article className={`expert-exam-chat__row expert-exam-chat__row--${role}`}>
      {role !== 'user' && (
        <div className={`expert-exam-chat__avatar expert-exam-chat__avatar--${role}`} aria-hidden="true">
          {role === 'teacher' ? <GraduationCap size={16} /> : <Sparkles size={16} />}
        </div>
      )}
      <div className={`expert-exam-chat__bubble expert-exam-chat__bubble--${role}`}>
        <header className="expert-exam-chat__meta">
          <strong>{name}</strong>
          {hint ? <span>{hint}</span> : null}
        </header>
        <div className="expert-exam-chat__body">{children}</div>
      </div>
    </article>
  );
}

export default function GoldQaExamCompare({ contribution }) {
  if (!contribution) return null;

  const teacherAnswer = formatTeacherGoldAnswer(contribution.goldAnswer) || 'Chưa có đáp án Teacher.';
  const aiAnswer = contribution.examAiAnswer || contribution.examError || 'Chưa chấm được.';

  return (
    <div className="expert-exam-chat">
      {contribution.question ? (
        <ExamChatTurn role="user" name="Câu hỏi vàng">
          <p className="expert-exam-chat__plain">{contribution.question}</p>
        </ExamChatTurn>
      ) : null}

      <ExamChatTurn role="teacher" name="Teacher" hint="Đáp án Gold Q&A · đã làm đẹp để dễ đọc">
        <AiAnswer markdown={teacherAnswer} hideSourceSection />
      </ExamChatTurn>

      <ExamChatTurn role="ai" name="AI Tutor" hint="Trả lời từ giáo trình, chưa nạp Q&A này">
        <AiAnswer markdown={aiAnswer} hideSourceSection />
      </ExamChatTurn>

      <footer className="expert-exam-chat__score">
        {contribution.examScore != null && (
          <Tag color={contribution.examPassed ? 'green' : 'orange'}>
            Điểm AI: {formatPercent(contribution.examScore)}
          </Tag>
        )}
        {contribution.examRagConfidence != null && (
          <Tag>RAG confidence: {formatPercent(contribution.examRagConfidence)}</Tag>
        )}
        <Tag color={contribution.examHallucinated ? 'red' : 'green'}>
          {contribution.examHallucinated ? 'Có nguy cơ hallucination' : 'Không phát hiện hallucination'}
        </Tag>
      </footer>
    </div>
  );
}
