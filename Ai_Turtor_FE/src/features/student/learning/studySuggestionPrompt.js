export function buildStudySuggestionPrompt(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';

  return `Em muốn ôn tập phần "${topic}" từ improve plan. Hãy hướng dẫn em từng bước trong đoạn chat này, giải thích dễ hiểu, có ví dụ nhỏ và gợi ý em nên tự kiểm tra gì tiếp theo.`;
}
