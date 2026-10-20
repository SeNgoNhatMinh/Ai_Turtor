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
      {quizzes.map((quiz, index) => (
        <UnderstandingCheckQuiz
          key={`${quiz.question}-${index}`}
          quiz={quiz}
          reviewer={reviewer}
          lockedKey={index === 0 ? understandingSelectedKey : ''}
          attemptId={attemptId ? `${attemptId}:${index + 1}` : `inline-quiz-${index + 1}`}
          onLockAnswer={index === 0 ? onLockAnswer : undefined}
        />
      ))}
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
