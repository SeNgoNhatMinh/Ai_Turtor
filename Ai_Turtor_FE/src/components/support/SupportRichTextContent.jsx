import { looksLikeRichHtml, sanitizeRichHtml } from '../../utils/richText';

export default function SupportRichTextContent({ content, className = '' }) {
  const safeContent = String(content || '');
  const classes = [className, looksLikeRichHtml(safeContent) ? 'is-rich' : '']
    .filter(Boolean)
    .join(' ');

  if (looksLikeRichHtml(safeContent)) {
    return (
      <div
        className={classes}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(safeContent) }}
      />
    );
  }

  return <p className={classes}>{safeContent}</p>;
}
