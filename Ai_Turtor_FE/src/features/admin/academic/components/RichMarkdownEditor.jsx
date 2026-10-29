import { useCallback, useRef, useState } from 'react';
import { Button, Input, Popover, Space, Tooltip } from 'antd';
import {
  Bold, Code, Eraser, Heading2, Heading3, Italic, Link2, List, ListOrdered,
  Quote, Redo2, Smile, Strikethrough, Undo2,
} from 'lucide-react';

const EMOJIS = ['📚', '✅', '⭐', '💡', '📝', '🎯', '⚠️', '🔑', '🚀', '📌'];

function EditorToolButton({ title, icon, onAction, disabled = false }) {
  return (
    <Tooltip title={title}>
      <Button
        size="small"
        type="text"
        aria-label={title}
        icon={icon}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAction}
      />
    </Tooltip>
  );
}

/**
 * Gmail-style compose toolbar on top of a Markdown textarea: formatting is
 * stored as Markdown so the student app renders it exactly as formatted,
 * with no HTML injection risk. Undo/redo history is kept locally because
 * programmatic edits replace the textarea value.
 */
function RichMarkdownEditor({ value, onChange, rows = 4, placeholder, ariaLabel, compact = false }) {
  const areaRef = useRef(null);
  const [history, setHistory] = useState({ past: [], future: [], lastPushAt: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);

  const focusRange = useCallback((start, end) => {
    requestAnimationFrame(() => {
      const element = areaRef.current?.resizableTextArea?.textArea || areaRef.current;
      if (!element) return;
      element.focus();
      if (start != null) element.setSelectionRange(start, end ?? start);
    });
  }, []);

  const applyChange = useCallback((next, selectionStart, selectionEnd) => {
    setHistory((current) => ({
      past: [...current.past, value].slice(-100),
      future: [],
      lastPushAt: current.lastPushAt,
    }));
    onChange(next);
    focusRange(selectionStart, selectionEnd);
  }, [focusRange, onChange, value]);

  const getRange = () => {
    const element = areaRef.current?.resizableTextArea?.textArea || areaRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    return [start, end];
  };

  const wrapSelection = (before, after = before, placeholderText = 'văn bản') => {
    const [start, end] = getRange();
    const selected = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    applyChange(next, start + before.length, start + before.length + selected.length);
  };

  const prefixLines = (prefixForLine) => {
    const [start, end] = getRange();
    const segmentStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const segment = value.slice(segmentStart, end);
    const nextSegment = segment.split('\n').map((line, index) => prefixForLine(line, index)).join('\n');
    const next = value.slice(0, segmentStart) + nextSegment + value.slice(end);
    applyChange(next, segmentStart, segmentStart + nextSegment.length);
  };

  const insertAtCursor = (text) => {
    const [start, end] = getRange();
    const next = value.slice(0, start) + text + value.slice(end);
    applyChange(next, start + text.length, start + text.length);
  };

  const insertLink = () => {
    const [start, end] = getRange();
    const selected = value.slice(start, end);
    const url = window.prompt('Địa chỉ liên kết (URL):', 'https://');
    if (!url) return;
    const label = selected || 'liên kết';
    const markdown = `[${label}](${url.trim()})`;
    const next = value.slice(0, start) + markdown + value.slice(end);
    applyChange(next, start, start + markdown.length);
  };

  const clearFormatting = () => {
    const [start, end] = getRange();
    const from = end > start ? start : 0;
    const to = end > start ? end : value.length;
    const cleaned = value.slice(from, to)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<\/?u>/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+[.)]\s+/gm, '');
    applyChange(value.slice(0, from) + cleaned + value.slice(to), from, from + cleaned.length);
  };

  const undo = () => {
    if (history.past.length === 0) return;
    const previous = history.past.at(-1);
    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [...current.future, value],
      lastPushAt: current.lastPushAt,
    }));
    onChange(previous);
    focusRange(previous.length, previous.length);
  };

  const redo = () => {
    if (history.future.length === 0) return;
    const next = history.future.at(-1);
    setHistory((current) => ({
      past: [...current.past, value].slice(-100),
      future: current.future.slice(0, -1),
      lastPushAt: current.lastPushAt,
    }));
    onChange(next);
    focusRange(next.length, next.length);
  };

  const handleTyping = (event) => {
    const next = event.target.value;
    const now = Date.now();
    if (now - history.lastPushAt > 800) {
      setHistory((current) => ({
        past: [...current.past, value].slice(-100),
        future: [],
        lastPushAt: now,
      }));
    }
    onChange(next);
  };

  const handleKeyDown = (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'b') { event.preventDefault(); wrapSelection('**'); }
    if (key === 'i') { event.preventDefault(); wrapSelection('*'); }
    if (key === 'u') { event.preventDefault(); wrapSelection('<u>', '</u>'); }
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
    if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); redo(); }
  };

  return (
    <div className="rich-markdown-editor">
      <div className="rich-markdown-editor__toolbar">
        <Space size={2} wrap>
          <EditorToolButton title="Hoàn tác (Ctrl+Z)" icon={<Undo2 size={15} />} onAction={undo} disabled={history.past.length === 0} />
          <EditorToolButton title="Làm lại (Ctrl+Y)" icon={<Redo2 size={15} />} onAction={redo} disabled={history.future.length === 0} />
          <span className="rich-markdown-editor__divider" />
          <EditorToolButton title="Đậm (Ctrl+B)" icon={<Bold size={15} />} onAction={() => wrapSelection('**')} />
          <EditorToolButton title="Nghiêng (Ctrl+I)" icon={<Italic size={15} />} onAction={() => wrapSelection('*')} />
          <EditorToolButton title="Gạch dưới (Ctrl+U)" icon={<UnderlineIcon />} onAction={() => wrapSelection('<u>', '</u>')} />
          <EditorToolButton title="Gạch ngang" icon={<Strikethrough size={15} />} onAction={() => wrapSelection('~~')} />
          {!compact && (
            <>
              <span className="rich-markdown-editor__divider" />
              <EditorToolButton title="Cỡ chữ lớn (tiêu đề)" icon={<Heading2 size={15} />} onAction={() => prefixLines((line) => `## ${line.replace(/^#{1,6}\s+/, '')}`)} />
              <EditorToolButton title="Cỡ chữ vừa (tiêu đề nhỏ)" icon={<Heading3 size={15} />} onAction={() => prefixLines((line) => `### ${line.replace(/^#{1,6}\s+/, '')}`)} />
              <EditorToolButton title="Danh sách dấu chấm" icon={<List size={15} />} onAction={() => prefixLines((line) => (line.trim() ? `- ${line.replace(/^[-*+]\s+/, '')}` : line))} />
              <EditorToolButton title="Danh sách số" icon={<ListOrdered size={15} />} onAction={() => prefixLines((line, index) => (line.trim() ? `${index + 1}. ${line.replace(/^\d+[.)]\s+/, '')}` : line))} />
              <EditorToolButton title="Trích dẫn" icon={<Quote size={15} />} onAction={() => prefixLines((line) => (line.trim() ? `> ${line}` : line))} />
              <EditorToolButton title="Mã code" icon={<Code size={15} />} onAction={() => wrapSelection('`')} />
            </>
          )}
          <EditorToolButton title="Chèn liên kết" icon={<Link2 size={15} />} onAction={insertLink} />
          <Popover
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            trigger="click"
            content={(
              <Space size={2} wrap style={{ maxWidth: 220 }}>
                {EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    size="small"
                    type="text"
                    aria-label={`Chèn biểu tượng ${emoji}`}
                    onClick={() => { insertAtCursor(emoji); setEmojiOpen(false); }}
                  >
                    {emoji}
                  </Button>
                ))}
              </Space>
            )}
          >
            <Tooltip title="Chèn biểu tượng cảm xúc">
              <Button size="small" type="text" aria-label="Chèn biểu tượng cảm xúc" icon={<Smile size={15} />} onMouseDown={(event) => event.preventDefault()} />
            </Tooltip>
          </Popover>
          <span className="rich-markdown-editor__divider" />
          <EditorToolButton title="Xóa định dạng" icon={<Eraser size={15} />} onAction={clearFormatting} />
        </Space>
      </div>
      <Input.TextArea
        ref={areaRef}
        aria-label={ariaLabel}
        variant="borderless"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={handleTyping}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

function UnderlineIcon() {
  return (
    <span style={{ fontSize: 13, fontWeight: 700, textDecoration: 'underline', lineHeight: 1 }}>U</span>
  );
}

export default RichMarkdownEditor;
