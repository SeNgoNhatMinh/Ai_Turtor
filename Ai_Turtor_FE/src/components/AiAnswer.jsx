import { memo, useMemo } from 'react';
import MarkdownRenderer from './markdown/MarkdownRenderer';
import UnderstandingCheckQuiz from '../features/student/chat/components/UnderstandingCheckQuiz';
import { extractUnderstandingCheck } from '../features/student/chat/understandingCheck';

function AiAnswer({
  markdown,
  streaming = false,
  sourceMap = {},
  onStudyTipStudy,
  onCheckAnswer,
  onDownloadSource,
  hideSourceSection = false,
}) {
  const { before, after, quiz } = useMemo(
    () => extractUnderstandingCheck(markdown),
    [markdown],
  );

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
      <UnderstandingCheckQuiz quiz={quiz} onCheckAnswer={onCheckAnswer} />
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
