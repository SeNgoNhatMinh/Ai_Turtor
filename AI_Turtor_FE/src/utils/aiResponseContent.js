const asNonEmptyText = (value) => (
  typeof value === 'string' && value.trim() ? value : ''
);

/**
 * Resolve the Markdown body from supported backend and n8n response envelopes.
 * Structured metadata stays outside the renderer; only a declared text field is rendered.
 */
export function getAiMarkdownContent(response = {}) {
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return '';

  return asNonEmptyText(response.answer)
    || asNonEmptyText(response.content)
    || asNonEmptyText(response.message);
}
