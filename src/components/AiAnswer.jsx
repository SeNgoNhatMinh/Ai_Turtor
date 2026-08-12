import { memo } from 'react';
import MarkdownRenderer from './markdown/MarkdownRenderer';

function AiAnswer({ markdown, streaming = false, sourceMap = {}, onStudyTipStudy, onDownloadSource, hideSourceSection = false }) {
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

export default memo(AiAnswer);
