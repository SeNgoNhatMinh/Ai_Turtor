import { memo } from 'react';
import CopyButton from './CopyButton';
import { getNodeText } from '../../utils/markdownPreprocessor';

function MarkdownTable({ children }) {
  const tableText = getNodeText(children).trim();

  return (
    <div className="ai-answer-table-wrap" role="region" aria-label="Bảng" tabIndex={0}>
      <CopyButton text={tableText} className="ai-answer-table-copy" />
      <table className="ai-answer-table">{children}</table>
    </div>
  );
}

export default memo(MarkdownTable);
