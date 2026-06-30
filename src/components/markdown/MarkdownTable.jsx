import React, { memo } from 'react';
import CopyButton from './CopyButton';
import { getNodeText } from '../../utils/markdownPreprocessor';

function MarkdownTable({ children }) {
  const tableText = getNodeText(children).trim();

  return (
    <div className="ai-answer-table-wrap" role="region" aria-label="Scrollable table" tabIndex={0}>
      <div className="ai-answer-format-toolbar">
        <span>Table</span>
        <CopyButton text={tableText} />
      </div>
      <table className="ai-answer-table">{children}</table>
    </div>
  );
}

export default memo(MarkdownTable);
