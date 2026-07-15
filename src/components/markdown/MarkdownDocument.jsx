import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

function MarkdownDocument({ content, components, remarkPlugins, rehypePlugins }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
      skipHtml
    >
      {content}
    </ReactMarkdown>
  );
}

export default memo(MarkdownDocument);
