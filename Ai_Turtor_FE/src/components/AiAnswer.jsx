import { memo, useMemo } from 'react';
import MarkdownRenderer from './markdown/MarkdownRenderer';
import UnderstandingCheckQuiz from '../features/student/chat/components/UnderstandingCheckQuiz';
import {
  extractUnderstandingCheck,
  normalizeStructuredUnderstandingQuiz,
} from '../features/student/chat/understandingCheck';

function AiAnswer({
  markdown,
  understandingCheck,
  understandingAttempts = [],
  streaming = false,
  sourceMap = {},
  onStudyTipStudy,
  onLockAnswer,
  onDownloadSource,
  hideSourceSection = false,
  reviewer = false,
  understandingSelectedKey = '',
  attemptId = '',
}) {
  const extracted = useMemo(
    () => extractUnderstandingCheck(markdown),
    [markdown],
  );
  const structuredQuiz = useMemo(
    () => normalizeStructuredUnderstandingQuiz(understandingCheck),
    [understandingCheck],
  );
  const quizzes = useMemo(() => {
    // The API payload is singular (the first item, used for grading), while
    // Worker 2 may write Q1/Q2/Q3 into the markdown for HIGH_SUPPORT and
    // CHALLENGE. Prefer the markdown items when more than one is present so
    // the extra questions are not hidden behind the singular payload.
    if (Array.isArray(extracted.quizzes) && extracted.quizzes.length > 1) return extracted.quizzes;
    if (structuredQuiz) return [structuredQuiz];
    if (Array.isArray(extracted.quizzes) && extracted.quizzes.length) return extracted.quizzes;
    return extracted.quiz ? [extracted.quiz] : [];
  }, [structuredQuiz, extracted.quizzes, extracted.quiz]);
  const { before, after } = extracted;

  if (!quizzes.length) {
    return (
      <MarkdownRenderer
        markdown={markdown}
        streaming={streaming}
        sourceMap={sourceMap}
        onStudyTipStudy={onStudyTipStudy}
        onDownloadSource={onDownloadSource}
        hideSourceSection={hideSourceSection}
      />
    );
  }

  return (
    <>
      {before ? (
        <MarkdownRenderer
          markdown={before}
          streaming={streaming}
          sourceMap={sourceMap}
          onStudyTipStudy={onStudyTipStudy}
          onDownloadSource={onDownloadSource}
          hideSourceSection={hideSourceSection}
        />
      ) : null}
      {quizzes.map((quiz, index) => {
        const savedAttempt = (Array.isArray(understandingAttempts) ? understandingAttempts : [])
          .find((attempt) => Number(attempt?.quizIndex ?? -1) === index);
        return (
          <UnderstandingCheckQuiz
            key={`${quiz.question}-${index}`}
            quiz={quiz}
            reviewer={reviewer}
            lockedKey={savedAttempt?.selectedKey || (index === 0 ? understandingSelectedKey : '')}
            attemptId={attemptId ? `${attemptId}:${index + 1}` : `inline-quiz-${index + 1}`}
            onLockAnswer={onLockAnswer
              ? (key, attempt) => onLockAnswer(key, { ...attempt, quizIndex: index })
              : undefined}
          />
        );
      })}
      {after ? (
        <MarkdownRenderer
          markdown={after}
          streaming={streaming}
          sourceMap={sourceMap}
          onStudyTipStudy={onStudyTipStudy}
          onDownloadSource={onDownloadSource}
          hideSourceSection={hideSourceSection}
        />
      ) : null}
    </>
  );
}

export default memo(AiAnswer);
