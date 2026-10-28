const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|<u>[^<\n]+<\/u>)/g;

/**
 * Renders the small inline-Markdown subset the curriculum editor toolbar can
 * produce (bold, italic, strike, code, links, underline) so the admin preview
 * matches what students see in chat. No raw HTML is injected.
 */
export function renderInlineMarkdown(text) {
  const source = String(text || '');
  const parts = source.split(INLINE_PATTERN);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={index}>{part.slice(2, -2)}</del>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (linkMatch) {
      return (
        <a key={index} href={linkMatch[2]} target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>
      );
    }
    if (part.startsWith('<u>') && part.endsWith('</u>')) return <u key={index}>{part.slice(3, -4)}</u>;
    return <span key={index}>{part}</span>;
  });
}

export function renderMarkdownLines(text) {
  const lines = String(text || '').split('\n');
  return lines.map((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    const content = headingMatch ? headingMatch[2] : line.replace(/^>\s?/, '');
    return (
      <span key={index}>
        {index > 0 && <br />}
        {headingMatch
          ? <strong>{renderInlineMarkdown(content)}</strong>
          : renderInlineMarkdown(content)}
      </span>
    );
  });
}
