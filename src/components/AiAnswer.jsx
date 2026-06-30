import React, { memo } from 'react';
import MarkdownRenderer from './markdown/MarkdownRenderer';

function AiAnswer({ markdown, streaming = false, sourceMap = {}, onStudyTipAnalyze }) {
  return (
    <MarkdownRenderer
      markdown={markdown}
      streaming={streaming}
      sourceMap={sourceMap}
      onStudyTipAnalyze={onStudyTipAnalyze}
    />
  );
}

export default memo(AiAnswer);
