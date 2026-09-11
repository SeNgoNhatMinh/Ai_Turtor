import React from 'react';
import ReactMarkdown from 'react-markdown';
import { sanitizeLinkUrl } from '../../utils/markdownSecurity';

const fallbackComponents = {
  h1: ({ children }) => <h2 className="ai-answer-heading">{children}</h2>,
  h2: ({ children }) => <h3 className="ai-answer-heading">{children}</h3>,
  h3: ({ children }) => <h3 className="ai-answer-heading">{children}</h3>,
  h4: ({ children }) => <h4 className="ai-answer-heading">{children}</h4>,
  h5: ({ children }) => <h4 className="ai-answer-heading">{children}</h4>,
  h6: ({ children }) => <h4 className="ai-answer-heading">{children}</h4>,
  p: ({ children }) => <p className="ai-answer-paragraph">{children}</p>,
  ul: ({ children }) => <ul className="ai-answer-list unordered">{children}</ul>,
  ol: ({ children }) => <ol className="ai-answer-list ordered">{children}</ol>,
  pre: ({ children }) => <pre className="ai-answer-fallback-code">{children}</pre>,
  code: ({ children }) => <code className="ai-answer-inline-code">{children}</code>,
  a: ({ href, children }) => {
    const safeHref = sanitizeLinkUrl(href);
    return safeHref ? (
      <a className="ai-answer-link" href={safeHref} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : <span>{children}</span>;
  },
};

function MarkdownFallback({ markdown }) {
  return (
    <div className="ai-answer ai-answer-prose ai-answer-fallback" role="status">
      <ReactMarkdown components={fallbackComponents} skipHtml>
        {String(markdown || '')}
      </ReactMarkdown>
    </div>
  );
}

class MarkdownErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('AI markdown render failed. Falling back to plain text.', error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.contentKey !== this.props.contentKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <MarkdownFallback markdown={this.props.fallbackText} />;
    }

    return this.props.children;
  }
}

export default MarkdownErrorBoundary;
