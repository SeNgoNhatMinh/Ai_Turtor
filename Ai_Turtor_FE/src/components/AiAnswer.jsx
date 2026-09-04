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
  const quiz = useMemo(
    () => normalizeStructuredUnderstandingQuiz(understandingCheck) || extracted.quiz,
    [understandingCheck, extracted.quiz],
  );
  const { before, after } = extracted;

  if (!quiz) {
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
      <UnderstandingCheckQuiz
        quiz={quiz}
        reviewer={reviewer}
        lockedKey={understandingSelectedKey}
        attemptId={attemptId}
        onLockAnswer={onLockAnswer}
      />
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
