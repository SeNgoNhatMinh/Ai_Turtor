import AiAnswer from '../../../components/AiAnswer';
import TutorMascot from '../../../components/common/TutorMascot';
import AnswerImproveSuggestions from '../../student/chat/components/AnswerImproveSuggestions';
import LessonDeepDiveCta from '../../student/chat/components/LessonDeepDiveCta';
import StudentMessageContent from '../../student/chat/components/StudentMessageContent';
import { shouldOfferLessonContinuations } from '../../../utils/errorMessages';
import { getPersonDisplayName } from '../../../utils/displayNames';
import {
  buildDeepDiveListPrompt,
  parseDeepDiveSuggestionsFromAnswer,
  parseNextLessonSuggestionsFromAnswer,
  teacherStudentPathLabel,
} from '../../student/learning/studySuggestionPrompt';
import {
  groupTranscriptTurns,
  transcriptMessageText,
} from './teacherTutoringStudents';

function TeacherStudyPathReview({ question, answer }) {
  if (!shouldOfferLessonContinuations({ answer })) return null;

  const nextLessons = parseNextLessonSuggestionsFromAnswer(answer);
  const deepDive = parseDeepDiveSuggestionsFromAnswer(answer);
  const showCta = nextLessons.length === 0
    && deepDive.length === 0
    && Boolean(buildDeepDiveListPrompt(question, answer));

  if (!nextLessons.length && !deepDive.length && !showCta) return null;

  return (
    <div className="teacher-transcript__study-path">
      {deepDive.length > 0 && (
        <AnswerImproveSuggestions
          suggestions={deepDive}
          readOnly
          heading="Học chuyên sâu"
          hint="Các hướng đào sâu AI đã đưa cho sinh viên."
        />
      )}
      {nextLessons.length > 0 && (
        <AnswerImproveSuggestions
          suggestions={nextLessons}
          readOnly
          heading="Bài tiếp theo"
          hint="Lộ trình bài kế sinh viên có thể chọn."
        />
      )}
      {showCta && (
        <LessonDeepDiveCta question={question} answer={answer} readOnly />
      )}
    </div>
  );
}

export default function TeacherTranscriptThread({ messages = [], student }) {
  const turns = groupTranscriptTurns(messages);
  const studentLabel = getPersonDisplayName(student, 'Sinh viên');

  if (!turns.length) {
    return <p className="teacher-transcript__empty">Chưa có tin nhắn trong buổi học này.</p>;
  }

  return (
    <div className="teacher-transcript-thread is-review" aria-label="Hội thoại AI Tutor">
      {turns.map((turn) => {
        const question = transcriptMessageText(turn.student);
        const answer = transcriptMessageText(turn.tutor);
        const pathLabel = teacherStudentPathLabel(question);
        return (
          <section key={turn.id} className="chat-message-turn">
            {turn.student ? (
              <div className="chat-gpt-message-row user">
                <div className="student-message-group">
                  <span className="teacher-transcript__speaker">
                    {studentLabel}
                    {pathLabel ? ` · ${pathLabel}` : ''}
                  </span>
                  <div className="chat-gpt-bubble-user">
                    <StudentMessageContent text={question} />
                  </div>
                </div>
              </div>
            ) : null}
            {turn.tutor ? (
              <div className="chat-gpt-message-row ai">
                <div className="chat-gpt-bubble-ai">
                  <div className="chat-gpt-ai-avatar">
                    <TutorMascot size="sm" />
                  </div>
                  <div className="chat-gpt-ai-content">
                    <span className="teacher-transcript__speaker">AI Tutor</span>
                    <AiAnswer
                      markdown={answer}
                      hideSourceSection
                      reviewer
                      understandingSelectedKey={turn.tutor?.understandingSelectedKey}
                      attemptId={turn.tutor?.id}
                    />
                    <TeacherStudyPathReview question={question} answer={answer} />
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
