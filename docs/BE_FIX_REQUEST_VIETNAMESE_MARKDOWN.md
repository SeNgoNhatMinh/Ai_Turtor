# BE Fix Request: Vietnamese Diacritics In AI Markdown

## Problem

AI answers sometimes contain correct Vietnamese and sometimes contain Vietnamese without diacritics. This is not caused by `react-markdown` or overlapping frontend renderers.

The frontend has one rendering path:

```text
AiAnswer
  -> MarkdownRenderer
  -> MarkdownDocument / MathMarkdownDocument
  -> react-markdown
```

The frontend preserves valid UTF-8 text, normalizes Unicode to NFC, and repairs identifiable UTF-8/Windows-1252 mojibake. It intentionally does not guess missing Vietnamese diacritics because that can change meaning.

## Confirmed Backend Sources

### Course RAG

`CourseRagService.java` currently instructs the model to emit unaccented headings:

```text
## Theo tai lieu mon hoc
## Vi du nho
## Luu y de hoc tot hon
## Nguon tai lieu da dung
```

Replace them with:

```text
## Theo tài liệu môn học
## Ví dụ nhỏ
## Lưu ý để học tốt hơn
## Nguồn tài liệu đã dùng
```

The system prompt should explicitly require natural Vietnamese with full diacritics for headings and body text.

### Code Mentor

`CodeMentorService.java` currently contains unaccented prompt headings and fallback responses, including:

```text
## Chan doan van de
## Nguyen nhan co the
## Cach debug tung buoc
## Goi y sua
## Vi du nho neu can
## Chu de nen on lai
```

It also returns hardcoded unaccented failure/empty messages. Replace all user-facing strings with UTF-8 Vietnamese containing full diacritics.

### n8n Education Workflow

`n8n-import/AI-tutor-workflow-runtime-fixed.json` contains this unaccented escalation response:

```text
Cau hoi da duoc gui cho giao vien/mentor phu trach.
```

Replace it with:

```text
Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.
```

Review all `responseBody`, Code, Set, and prompt nodes for similar user-facing strings.

## Required Encoding Contract

- Source files and workflow JSON must be UTF-8.
- HTTP JSON responses must use `Content-Type: application/json; charset=UTF-8`.
- Do not convert generated text through ISO-8859-1 or Windows-1252.
- Preserve the model output as Unicode; do not strip combining marks or Vietnamese tones.
- Return valid Markdown headings with `##` instead of relying on frontend heading inference.

## Acceptance Tests

1. Ask a Vietnamese question through the RAG flow and verify every heading and paragraph contains natural Vietnamese diacritics.
2. Trigger Code Mentor success, empty-response, and exception paths; all visible copy must contain correct diacritics.
3. Trigger the n8n `ESCALATE` branch and verify its answer is correctly accented.
4. Verify JSON round-trip text such as `Lỗi máy chủ: AI Tutor chưa thể gọi dịch vụ LLM.` is unchanged.
5. Verify source filenames, code blocks, formulas, and IDs are not altered.

## Frontend Boundary

The frontend will continue to:

- normalize valid text to Unicode NFC;
- repair deterministic mojibake such as `Lá»—i mÃ¡y chá»§`;
- render Markdown safely;
- preserve arbitrary unaccented AI content instead of guessing its meaning.

Missing-diacritic restoration belongs in the model prompt or backend output, not in a frontend normalization library. Packages commonly described as diacritic normalizers remove or canonicalize marks; they do not reliably restore Vietnamese words from context.
