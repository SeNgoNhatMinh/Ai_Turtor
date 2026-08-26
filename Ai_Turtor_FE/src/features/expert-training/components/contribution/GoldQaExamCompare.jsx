import {
  ArrowRight,
  BookOpenText,
  CircleAlert,
  CircleCheck,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import AiAnswer from '../../../../components/AiAnswer';
import { formatTeacherGoldAnswer } from '../../../../utils/teacherGoldAnswerFormat';
import { formatPercent } from '../../expertTrainingUtils';

function AnswerPanel({
  role,
  step,
  name,
  hint,
  icon,
  score,
  scoreTone,
  children,
}) {
  return (
    <article className={`expert-exam-panel expert-exam-panel--${role}`}>
      <header className="expert-exam-panel__head">
        <div className="expert-exam-panel__title-row">
          {step != null && <span className="expert-exam-panel__step">{step}</span>}
          <span className={`expert-exam-panel__icon expert-exam-panel__icon--${role}`} aria-hidden="true">
            {icon}
          </span>
          <div className="expert-exam-panel__titles">
            <strong>{name}</strong>
            <span>{hint}</span>
          </div>
        </div>
        {score != null && (
          <div className={`expert-exam-panel__score expert-exam-panel__score--${scoreTone || 'neutral'}`}>
            {score}
          </div>
        )}
      </header>
      <div className="expert-exam-panel__body">{children}</div>
    </article>
  );
}

function MetricChip({ label, value, tone = 'neutral' }) {
  return (
    <div className={`expert-exam-chip expert-exam-chip--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function scoreTone(passed) {
  if (passed == null) return 'neutral';
  return passed ? 'success' : 'warning';
}

export default function GoldQaExamCompare({ contribution }) {
  if (!contribution) return null;

  const teacherAnswer = formatTeacherGoldAnswer(contribution.goldAnswer) || 'Chưa có tóm tắt theo giáo trình.';
  const baselineAnswer = contribution.examBaselineAiAnswer || '';
  const improvedAnswer = contribution.examUsedTeachingNote
    ? (contribution.examAiAnswer || contribution.examError || '')
    : '';
  const latestAnswer = contribution.examAiAnswer || contribution.examError || 'Chưa chấm được.';
  const showBeforeAfter = Boolean(baselineAnswer && contribution.examUsedTeachingNote && improvedAnswer);
  const baselineOnly = !showBeforeAfter && !contribution.examUsedTeachingNote;

  const beforeScore = contribution.examBaselineScore != null
    ? formatPercent(contribution.examBaselineScore)
    : (baselineOnly && contribution.examScore != null ? formatPercent(contribution.examScore) : null);
  const afterScore = contribution.examUsedTeachingNote && contribution.examScore != null
    ? formatPercent(contribution.examScore)
    : null;
  const delta = contribution.examBaselineScore != null && contribution.examScore != null
    && contribution.examUsedTeachingNote
    ? contribution.examScore - contribution.examBaselineScore
    : null;

  return (
    <div className="expert-exam-chat">
      <div className="expert-exam-question">
        <BookOpenText size={17} />
        <div>
          <span>Câu hỏi kiểm tra</span>
          <strong>{contribution.question || 'Chưa có câu hỏi.'}</strong>
        </div>
      </div>

      <div className="expert-exam-scorebar" role="group" aria-label="Điểm bài thi">
        {beforeScore != null && (
          <MetricChip
            label="Lần 1 · chưa ý GV"
            value={beforeScore}
            tone={scoreTone(
              contribution.examBaselinePassed != null
                ? contribution.examBaselinePassed
                : contribution.examPassed,
            )}
          />
        )}
        {showBeforeAfter && (
          <span className="expert-exam-scorebar__arrow" aria-hidden="true">
            <ArrowRight size={16} />
          </span>
        )}
        {afterScore != null && (
          <MetricChip
            label="Lần 2 · có ý GV"
            value={afterScore}
            tone={scoreTone(contribution.examPassed)}
          />
        )}
        {delta != null && (
          <MetricChip
            label="Chênh lệch"
            value={`${delta >= 0 ? '+' : ''}${formatPercent(delta)}`}
            tone={delta >= 0 ? 'success' : 'warning'}
          />
        )}
        {contribution.examRagConfidence != null && (
          <MetricChip
            label="RAG confidence"
            value={formatPercent(contribution.examRagConfidence)}
          />
        )}
        <MetricChip
          label="Bịa nội dung"
          value={(
            <>
              {contribution.examHallucinated ? <CircleAlert size={14} /> : <CircleCheck size={14} />}
              {contribution.examHallucinated ? 'Có nguy cơ' : 'Không phát hiện'}
            </>
          )}
          tone={contribution.examHallucinated ? 'danger' : 'success'}
        />
      </div>

      {baselineOnly && (
        <p className="expert-exam-hint expert-exam-hint--warn">
          Đây là lần 1 — AI chưa dùng tóm tắt ý của bạn. Bấm <strong>Cho AI thi lại</strong> để so sánh trước/sau.
        </p>
      )}
      {showBeforeAfter && (
        <p className="expert-exam-hint expert-exam-hint--ok">
          Lần 2 đã <strong>gộp</strong> câu lần 1 với ý GV (không chỉ paraphrase checklist). Đối chiếu Trước | Sau.
        </p>
      )}

      <AnswerPanel
        role="teacher"
        step={0}
        name="Ý chính giáo viên"
        hint="Tóm tắt từ sách — chuẩn để chấm, không thay giáo trình"
        icon={<GraduationCap size={15} />}
      >
        <AiAnswer markdown={teacherAnswer} hideSourceSection />
      </AnswerPanel>

      {showBeforeAfter ? (
        <div className="expert-exam-duo" aria-label="So sánh trước và sau">
          <AnswerPanel
            role="before"
            step={1}
            name="Trước"
            hint="AI chưa gắn ý GV · chỉ sách/RAG"
            icon={<Sparkles size={15} />}
            score={beforeScore}
            scoreTone={scoreTone(contribution.examBaselinePassed)}
          >
            <AiAnswer markdown={baselineAnswer} hideSourceSection />
          </AnswerPanel>
          <AnswerPanel
            role="after"
            step={2}
            name="Sau"
            hint="AI gộp lần 1 + ý GV · chưa nạp RAG thật"
            icon={<Sparkles size={15} />}
            score={afterScore}
            scoreTone={scoreTone(contribution.examPassed)}
          >
            <AiAnswer markdown={improvedAnswer} hideSourceSection />
          </AnswerPanel>
        </div>
      ) : (
        <AnswerPanel
          role={contribution.examUsedTeachingNote ? 'after' : 'before'}
          step={1}
          name={contribution.examUsedTeachingNote ? 'Câu trả lời AI (có ý GV)' : 'Câu trả lời AI (chưa gắn ý GV)'}
          hint={contribution.examUsedTeachingNote
            ? 'Như khi SV hỏi sau khi có teaching note'
            : 'Chỉ dựa câu hỏi + sách/RAG — chưa dùng tóm tắt ý Teacher'}
          icon={<Sparkles size={15} />}
          score={contribution.examScore == null ? null : formatPercent(contribution.examScore)}
          scoreTone={scoreTone(contribution.examPassed)}
        >
          <AiAnswer markdown={latestAnswer} hideSourceSection />
        </AnswerPanel>
      )}
    </div>
  );
}
