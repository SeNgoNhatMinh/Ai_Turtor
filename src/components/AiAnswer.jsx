import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const SECTION_LABELS = {
  summary: 'Summary',
  explanation: 'Explanation',
  steps: 'Steps',
  example: 'Example',
  note: 'Note',
  notes: 'Notes',
  warning: 'Warning',
  answer: 'Answer',
};

function normalizeMarkdown(markdown = '') {
  return String(markdown)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderInline(text = '') {
  const nodes = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={match.index} className="ai-answer-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }

    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

function parseTable(lines, startIndex) {
  const header = lines[startIndex]?.trim();
  const divider = lines[startIndex + 1]?.trim();
  if (!header?.includes('|') || !/^\|?[\s:-|]+\|?$/.test(divider || '')) return null;

  const parseCells = (line) => line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

  const headers = parseCells(header);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    rows.push(parseCells(lines[index]));
    index += 1;
  }

  return { headers, rows, nextIndex: index };
}

function getSectionLabel(text) {
  const key = text.toLowerCase().replace(/[:：]/g, '').trim();
  return SECTION_LABELS[key] || text;
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

export default function AiAnswer({ markdown }) {
  const content = normalizeMarkdown(markdown);
  if (!content) return null;

  const lines = content.split('\n');
  const blocks = [];
  let listItems = null;
  let listOrdered = false;

  const flushList = () => {
    if (!listItems?.length) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`list-${blocks.length}`} className={`ai-answer-list ${listOrdered ? 'ordered' : 'unordered'}`}>
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = null;
    listOrdered = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushList();
      continue;
    }

    if (line.trim().startsWith('```')) {
      flushList();
      const language = line.trim().slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push(
        <figure key={`code-${blocks.length}`} className="ai-answer-code-block">
          <figcaption>
            <span>{language || 'Code'}</span>
            <CopyButton text={codeLines.join('\n')} />
          </figcaption>
          <pre><code>{codeLines.join('\n')}</code></pre>
        </figure>
      );
      continue;
    }

    const table = parseTable(lines, i);
    if (table) {
      flushList();
      const tableText = [
        table.headers.join('\t'),
        ...table.rows.map((row) => table.headers.map((_, index) => row[index] || '').join('\t')),
      ].join('\n');
      blocks.push(
        <div key={`table-${blocks.length}`} className="ai-answer-table-wrap">
          <div className="ai-answer-format-toolbar">
            <span>Table</span>
            <CopyButton text={tableText} />
          </div>
          <table className="ai-answer-table">
            <thead>
              <tr>{table.headers.map((cell, index) => <th key={index}>{renderInline(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {table.headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] || '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = table.nextIndex - 1;
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const Tag = level === 2 ? 'h3' : 'h4';
      blocks.push(
        <Tag key={`heading-${blocks.length}`} className="ai-answer-heading">
          {getSectionLabel(heading[2])}
        </Tag>
      );
      continue;
    }

    const labelLine = line.match(/^\*\*([^*]{2,40})\*\*:?\s*(.*)$/);
    if (labelLine) {
      flushList();
      const calloutText = `${getSectionLabel(labelLine[1])}${labelLine[2] ? `: ${labelLine[2]}` : ''}`;
      blocks.push(
        <div key={`section-${blocks.length}`} className="ai-answer-section-callout">
          <CopyButton text={calloutText} />
          <span>{getSectionLabel(labelLine[1])}</span>
          {labelLine[2] && <p>{renderInline(labelLine[2])}</p>}
        </div>
      );
      continue;
    }

    if (line.trim().startsWith('>')) {
      flushList();
      const quoteText = line.replace(/^>\s?/, '');
      blocks.push(
        <blockquote key={`quote-${blocks.length}`} className="ai-answer-quote">
          <CopyButton text={quoteText} />
          {renderInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.+)/);
    if (bullet) {
      if (!listItems || listOrdered) listItems = [];
      listOrdered = false;
      listItems.push(bullet[1]);
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)/);
    if (ordered) {
      if (!listItems || !listOrdered) listItems = [];
      listOrdered = true;
      listItems.push(ordered[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="ai-answer-paragraph">
        {renderInline(line.trim())}
      </p>
    );
  }

  flushList();

  return <div className="ai-answer">{blocks}</div>;
}
