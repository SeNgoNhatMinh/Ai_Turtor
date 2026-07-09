import React, { memo, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import 'katex/dist/katex.min.css';
import { getNodeText, normalizeAiMarkdown, stripSourceSection } from '../../utils/markdownPreprocessor';
import { sanitizeLinkUrl } from '../../utils/markdownSecurity';
import { formatSourceItems, isMaterialSourceText } from '../../utils/sourceLabels';
import CodeBlock from './CodeBlock';
import CopyButton from './CopyButton';
import MarkdownErrorBoundary from './MarkdownErrorBoundary';
import MarkdownImage from './MarkdownImage';
import MarkdownTable from './MarkdownTable';

const rehypeKatexOptions = {
  throwOnError: false,
  strict: 'ignore',
  output: 'htmlAndMathml',
};

function HeadingRenderer({ Tag, children, ...props }) {
  return (
    <Tag {...props} className="ai-answer-heading">
      {children}
    </Tag>
  );
}

function SourcePill({ sourceText, sourceMap, onDownloadSource }) {
  const sources = formatSourceItems(sourceText, sourceMap);
  const displayText = sources.map((source) => source.label).join(', ');
  const firstDownloadable = sources.find((source) => source.id);

  return (
    <div className="ai-answer-source-pill">
      {firstDownloadable && onDownloadSource ? (
        <button
          type="button"
          className="ai-answer-source-download"
          onClick={() => onDownloadSource(firstDownloadable.id, firstDownloadable.label)}
          title="Download this source material"
        >
          {displayText}
        </button>
      ) : (
        <code>{displayText}</code>
      )}
      <CopyButton text={displayText} />
    </div>
  );
}

function ParagraphRenderer({ children, sourceMap, onDownloadSource }) {
  const text = getNodeText(children).trim();
  const resultLine = text.match(/^(Kết quả|Result)\s*[:：]\s*(.+)$/i);

  if (resultLine) {
    return (
      <div className="ai-answer-section-callout ai-answer-section-callout--result">
        <CopyButton text={text} />
        <span>{resultLine[1]}</span>
        <p>{children}</p>
      </div>
    );
  }

  if (isMaterialSourceText(text)) {
    return <SourcePill sourceText={text} sourceMap={sourceMap} onDownloadSource={onDownloadSource} />;
  }

  return <p className="ai-answer-paragraph">{children}</p>;
}

function CodeRenderer({ inline, className = '', children, ...props }) {
  const code = String(children || '');
  const hasBlockLanguage = String(className).includes('language-');
  const isBlock = !inline && (hasBlockLanguage || code.includes('\n'));

  if (!isBlock) {
    return (
      <code {...props} className="ai-answer-inline-code">
        {children}
      </code>
    );
  }

  return <CodeBlock className={className}>{code}</CodeBlock>;
}

function LinkRenderer({ href, children, onStudyTipAnalyze, ...props }) {
  if (String(href || '').startsWith('#ai-study-tip-')) {
    const text = getNodeText(children).trim();
    return (
      <button
        type="button"
        className="ai-answer-study-tip"
        onClick={() => onStudyTipAnalyze?.(text)}
        title="Analyze this study suggestion"
      >
        {children}
      </button>
    );
  }

  const safeHref = sanitizeLinkUrl(href);

  if (!safeHref) {
    return <span className="ai-answer-link-disabled">{children}</span>;
  }

  const isAnchor = safeHref.startsWith('#');
  return (
    <a
      {...props}
      href={safeHref}
      className="ai-answer-link"
      target={isAnchor ? undefined : '_blank'}
      rel={isAnchor ? undefined : 'noreferrer'}
    >
      {children}
    </a>
  );
}

function createMarkdownComponents({ sourceMap, onStudyTipAnalyze, onDownloadSource }) {
  return {
    h1: (props) => <HeadingRenderer Tag="h2" {...props} />,
    h2: (props) => <HeadingRenderer Tag="h3" {...props} />,
    h3: (props) => <HeadingRenderer Tag="h3" {...props} />,
    h4: (props) => <HeadingRenderer Tag="h4" {...props} />,
    h5: (props) => <HeadingRenderer Tag="h4" {...props} />,
    h6: (props) => <HeadingRenderer Tag="h4" {...props} />,
    p: (props) => <ParagraphRenderer {...props} sourceMap={sourceMap} onDownloadSource={onDownloadSource} />,
    pre: ({ children }) => <>{children}</>,
    code: CodeRenderer,
    table: MarkdownTable,
    img: MarkdownImage,
    ul: ({ children }) => <ul className="ai-answer-list unordered">{children}</ul>,
    ol: ({ children }) => <ol className="ai-answer-list ordered">{children}</ol>,
    li: ({ children }) => {
      const text = getNodeText(children).trim();
      if (isMaterialSourceText(text)) {
        return (
          <li className="ai-answer-source-list-item">
            <SourcePill sourceText={text} sourceMap={sourceMap} onDownloadSource={onDownloadSource} />
          </li>
        );
      }
      return <li>{children}</li>;
    },
    blockquote: ({ children }) => (
      <blockquote className="ai-answer-quote">
        <CopyButton text={getNodeText(children).trim()} />
        {children}
      </blockquote>
    ),
    a: (props) => <LinkRenderer {...props} onStudyTipAnalyze={onStudyTipAnalyze} />,
    input: ({ checked, ...props }) => (
      <input {...props} checked={checked} className="ai-answer-task-checkbox" readOnly />
    ),
    hr: () => <hr className="ai-answer-hr" />,
  };
}

function MarkdownRenderer({ markdown, streaming = false, sourceMap = {}, onStudyTipAnalyze, onDownloadSource, hideSourceSection = false }) {
  const rootRef = useRef(null);
  const content = useMemo(() => {
    const normalized = normalizeAiMarkdown(markdown);
    return hideSourceSection ? stripSourceSection(normalized) : normalized;
  }, [markdown, hideSourceSection]);
  const components = useMemo(
    () => createMarkdownComponents({ sourceMap, onStudyTipAnalyze, onDownloadSource }),
    [sourceMap, onStudyTipAnalyze, onDownloadSource],
  );

  useEffect(() => {
    const errors = rootRef.current?.querySelectorAll('.katex-error');
    if (errors?.length) {
      console.warn(
        'KaTeX could not parse part of the AI answer. Rendering raw formula text.',
        Array.from(errors).map((node) => node.textContent),
      );
    }
  }, [content]);

  if (!content) return null;

  return (
    <MarkdownErrorBoundary contentKey={content} fallbackText={content}>
      <div ref={rootRef} className={`ai-answer ai-answer-prose ${streaming ? 'is-streaming' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            [rehypeKatex, rehypeKatexOptions],
            rehypeSlug,
          ]}
          components={components}
          skipHtml
        >
          {content}
        </ReactMarkdown>
        {streaming && <span className="ai-answer-stream-cursor" aria-hidden="true" />}
      </div>
    </MarkdownErrorBoundary>
  );
}

export default memo(MarkdownRenderer);
