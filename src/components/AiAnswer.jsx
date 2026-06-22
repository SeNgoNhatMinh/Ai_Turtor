import React from 'react';

/** Inline **bold** and *italic* */
function renderInline(text) {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-primary-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

/**
 * Renders markdown answers from /api/ai/query (headings, lists, paragraphs).
 */
export default function AiAnswer({ markdown }) {
  const lines = markdown.split("\n");
  const blocks = [];
  let listItems = null;
  let listOrdered = false;

  const flushList = () => {
    if (!listItems?.length) return;
    const Tag = listOrdered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={`mb-3 pl-5 space-y-1.5 text-[14px] text-primary-800 leading-relaxed ${
          listOrdered ? "list-decimal" : "list-disc"
        }`}
      >
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = null;
    listOrdered = false;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3
          key={`h2-${blocks.length}`}
          className="font-display text-[15px] font-bold text-primary-900 mt-4 mb-2 first:mt-0"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h4
          key={`h3-${blocks.length}`}
          className="font-display text-[14px] font-semibold text-primary-900 mt-3 mb-1.5"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.+)/);
    if (bullet) {
      if (!listItems) listItems = [];
      listItems.push(bullet[1]);
      listOrdered = false;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)/);
    if (ordered) {
      if (!listItems) listItems = [];
      listItems.push(ordered[1]);
      listOrdered = true;
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-[14px] text-primary-800 leading-[1.75] mb-2 last:mb-0">
        {renderInline(line)}
      </p>
    );
  }

  flushList();

  return <div className="ai-answer">{blocks}</div>;
}
