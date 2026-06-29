import React, { useMemo, useState } from 'react';
import { MarkdownHooks } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from '@shikijs/langs/bash';
import c from '@shikijs/langs/c';
import cpp from '@shikijs/langs/cpp';
import csharp from '@shikijs/langs/csharp';
import css from '@shikijs/langs/css';
import html from '@shikijs/langs/html';
import java from '@shikijs/langs/java';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import jsx from '@shikijs/langs/jsx';
import markdownLang from '@shikijs/langs/markdown';
import python from '@shikijs/langs/python';
import shellscript from '@shikijs/langs/shellscript';
import sql from '@shikijs/langs/sql';
import tsx from '@shikijs/langs/tsx';
import typescript from '@shikijs/langs/typescript';
import xml from '@shikijs/langs/xml';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { Check, Copy } from 'lucide-react';
import 'katex/dist/katex.min.css';

const SECTION_LABELS = {
  'theo tài liệu môn học': 'Theo tài liệu môn học',
  summary: 'Summary',
  explanation: 'Explanation',
  steps: 'Steps',
  example: 'Example',
  note: 'Note',
  notes: 'Notes',
  warning: 'Warning',
  answer: 'Answer',
};

const PLAIN_HEADING_PATTERNS = [
  /^theo tài liệu môn học$/i,
  /^mô tả\b/i,
  /^cấu trúc\b/i,
  /^giá trị\b/i,
  /^các .+ được đề cập$/i,
  /^thuật toán\b/i,
  /^ví dụ\b/i,
  /^lưu ý\b/i,
  /^nguồn tài liệu\b/i,
  /^công thức\b/i,
  /^định nghĩa\b/i,
];

let highlighterPromise;

function getAiAnswerHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [
        bash,
        c,
        cpp,
        csharp,
        css,
        html,
        java,
        javascript,
        json,
        jsx,
        markdownLang,
        python,
        shellscript,
        sql,
        tsx,
        typescript,
        xml,
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }

  return highlighterPromise;
}

const prettyCodeOptions = {
  theme: {
    light: 'github-light',
    dark: 'github-dark',
  },
  getHighlighter: getAiAnswerHighlighter,
  keepBackground: false,
  defaultLang: {
    block: 'plaintext',
    inline: 'plaintext',
  },
};

const autolinkHeadingOptions = {
  behavior: 'append',
  properties: {
    className: ['ai-answer-heading-anchor'],
    ariaLabel: 'Link to section',
  },
  content: {
    type: 'text',
    value: '#',
  },
};

const isTableLine = (line = '') => {
  const text = line.trim();
  return text.startsWith('|') && text.endsWith('|') && text.includes('|');
};

const isListLine = (line = '') => /^\s*(?:[-*]|\d+[.)])\s+/.test(line);

function getSectionLabel(text = '') {
  const key = text.toLowerCase().replace(/[:：]/g, '').trim();
  return SECTION_LABELS[key] || text;
}

function getNextTextLine(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index]?.trim()) return lines[index];
  }
  return '';
}

function isPlainHeading(line, nextLine = '') {
  const text = line.trim();
  if (!text || text.length > 90) return false;
  if (/^#{1,6}\s+/.test(text)) return false;
  if (isTableLine(text) || isListLine(text)) return false;
  if (text.startsWith('```') || text === '\\[' || text === '$$') return false;
  if (!nextLine.trim()) return false;
  return PLAIN_HEADING_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeLooseBlocks(text = '') {
  const lines = text.split('\n');
  const normalized = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const prev = normalized[normalized.length - 1] || '';
    const next = lines[index + 1] || '';

    if (!line.trim()) {
      const joinsTable = isTableLine(prev) && isTableLine(next);
      const joinsList = isListLine(prev) && isListLine(next);
      if (joinsTable || joinsList) continue;
    }

    normalized.push(line);
  }

  return normalized.join('\n');
}

function normalizeAiMarkdown(markdown = '') {
  const compactText = String(markdown)
    .replace(/\r\n/g, '\n')
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const lines = normalizeLooseBlocks(compactText).split('\n');

  return lines
    .map((line, index) => {
      if (isPlainHeading(line, getNextTextLine(lines, index))) {
        return `### ${getSectionLabel(line.trim().replace(/[:：]$/, ''))}`;
      }
      return line;
    })
    .join('\n');
}

function getNodeText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (React.isValidElement(node)) return getNodeText(node.props.children);
  return '';
}

function getLanguageFromNode(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) {
    return node.map(getLanguageFromNode).find(Boolean) || '';
  }
  if (!React.isValidElement(node)) return '';

  const { className = '', children } = node.props;
  const language = node.props['data-language'] || String(className).match(/language-([\w-]+)/)?.[1];
  return language || getLanguageFromNode(children);
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className={`ai-answer-copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy'}
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

function HeadingRenderer({ Tag, children, ...props }) {
  return (
    <Tag {...props} className="ai-answer-heading">
      {children}
    </Tag>
  );
}

function ParagraphRenderer({ children }) {
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

  if (/^materialId=/.test(text)) {
    return (
      <div className="ai-answer-source-pill">
        <code>{text}</code>
        <CopyButton text={text} />
      </div>
    );
  }

  return <p className="ai-answer-paragraph">{children}</p>;
}

function PreRenderer({ children, ...props }) {
  const codeText = getNodeText(children).replace(/\n$/, '');
  const language = getLanguageFromNode(children) || props['data-language'] || 'Code';

  return (
    <div className="ai-answer-code-block">
      <div className="ai-answer-format-toolbar">
        <span>{language}</span>
        <CopyButton text={codeText} />
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
}

function CodeRenderer({ className = '', children, ...props }) {
  const isPrettyCode = Boolean(props['data-language'] || props['data-theme']);
  const isBlockLanguage = String(className).includes('language-');

  if (!isPrettyCode && !isBlockLanguage) {
    return (
      <code {...props} className="ai-answer-inline-code">
        {children}
      </code>
    );
  }

  return (
    <code {...props} className={`ai-answer-code ${className}`.trim()}>
      {children}
    </code>
  );
}

function TableRenderer({ children }) {
  const tableText = getNodeText(children);

  return (
    <div className="ai-answer-table-wrap">
      <div className="ai-answer-format-toolbar">
        <span>Table</span>
        <CopyButton text={tableText} />
      </div>
      <table className="ai-answer-table">{children}</table>
    </div>
  );
}

const markdownComponents = {
  h1: (props) => <HeadingRenderer Tag="h2" {...props} />,
  h2: (props) => <HeadingRenderer Tag="h3" {...props} />,
  h3: (props) => <HeadingRenderer Tag="h3" {...props} />,
  h4: (props) => <HeadingRenderer Tag="h4" {...props} />,
  h5: (props) => <HeadingRenderer Tag="h4" {...props} />,
  h6: (props) => <HeadingRenderer Tag="h4" {...props} />,
  p: ParagraphRenderer,
  pre: PreRenderer,
  code: CodeRenderer,
  table: TableRenderer,
  ul: ({ children }) => <ul className="ai-answer-list unordered">{children}</ul>,
  ol: ({ children }) => <ol className="ai-answer-list ordered">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="ai-answer-quote">
      <CopyButton text={getNodeText(children).trim()} />
      {children}
    </blockquote>
  ),
  a: ({ href, children, ...props }) => (
    <a
      {...props}
      href={href}
      className="ai-answer-link"
      target={href?.startsWith('#') ? undefined : '_blank'}
      rel={href?.startsWith('#') ? undefined : 'noreferrer'}
    >
      {children}
    </a>
  ),
  input: ({ checked, ...props }) => (
    <input {...props} checked={checked} className="ai-answer-task-checkbox" readOnly />
  ),
};

export default function AiAnswer({ markdown }) {
  const content = useMemo(() => normalizeAiMarkdown(markdown), [markdown]);
  if (!content) return null;

  return (
    <div className="ai-answer ai-answer-prose">
      <MarkdownHooks
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          rehypeSlug,
          [rehypeAutolinkHeadings, autolinkHeadingOptions],
          [rehypePrettyCode, prettyCodeOptions],
        ]}
        components={markdownComponents}
        skipHtml
        fallback={<div className="ai-answer-formatting">Formatting answer...</div>}
      >
        {content}
      </MarkdownHooks>
    </div>
  );
}
