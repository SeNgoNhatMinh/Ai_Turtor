import { memo } from 'react';
import MarkdownRenderer from './markdown/MarkdownRenderer';

function AiAnswer({ markdown, streaming = false, sourceMap = {}, onStudyTipAnalyze, onDownloadSource, hideSourceSection = false }) {
  return (
    <MarkdownRenderer
      markdown={markdown}
      streaming={streaming}
      sourceMap={sourceMap}
      onStudyTipAnalyze={onStudyTipAnalyze}
      onDownloadSource={onDownloadSource}
      hideSourceSection={hideSourceSection}
    />
  );
}

export default memo(AiAnswer);
