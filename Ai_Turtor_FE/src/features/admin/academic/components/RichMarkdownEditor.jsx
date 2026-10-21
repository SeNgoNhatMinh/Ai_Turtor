import { useCallback, useRef, useState } from 'react';
import { Button, Input, Popover, Space, Tooltip } from 'antd';
import {
  Bold, Code, Eraser, Heading2, Heading3, Italic, Link2, List, ListOrdered,
  Quote, Redo2, Smile, Strikethrough, Undo2,
} from 'lucide-react';

const EMOJIS = ['📚', '✅', '⭐', '💡', '📝', '🎯', '⚠️', '🔑', '🚀', '📌'];

/**
 * Gmail-style compose toolbar on top of a Markdown textarea: formatting is
 * stored as Markdown so the student app renders it exactly as formatted,
 * with no HTML injection risk. Undo/redo history is kept locally because
 * programmatic edits replace the textarea value.
 */
function RichMarkdownEditor({ value, onChange, rows = 4, placeholder, ariaLabel, compact = false }) {
  const areaRef = useRef(null);
  const historyRef = useRef({ past: [], future: [], lastPushAt: 0 });
  const [, setHistoryTick] = useState(0);
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
    const history = historyRef.current;
    history.past.push(value);
    if (history.past.length > 100) history.past.shift();
    history.future = [];
    setHistoryTick((tick) => tick + 1);
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
    const history = historyRef.current;
    if (history.past.length === 0) return;
    history.future.push(value);
    const previous = history.past.pop();
    setHistoryTick((tick) => tick + 1);
    onChange(previous);
    focusRange(previous.length, previous.length);
  };

  const redo = () => {
    const history = historyRef.current;
    if (history.future.length === 0) return;
    history.past.push(value);
    const next = history.future.pop();
    setHistoryTick((tick) => tick + 1);
    onChange(next);
    focusRange(next.length, next.length);
  };

  const handleTyping = (event) => {
    const next = event.target.value;
    const history = historyRef.current;
    const now = Date.now();
    if (now - history.lastPushAt > 800) {
      history.past.push(value);
      if (history.past.length > 100) history.past.shift();
      history.future = [];
      history.lastPushAt = now;
      setHistoryTick((tick) => tick + 1);
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

  const toolButton = (title, icon, action, disabled = false) => (
    <Tooltip key={title} title={title}>
      <Button
        size="small"
        type="text"
        aria-label={title}
        icon={icon}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
      />
    </Tooltip>
  );

  const history = historyRef.current;

  return (
    <div className="rich-markdown-editor">
      <div className="rich-markdown-editor__toolbar">
        <Space size={2} wrap>
          {toolButton('Hoàn tác (Ctrl+Z)', <Undo2 size={15} />, undo, history.past.length === 0)}
          {toolButton('Làm lại (Ctrl+Y)', <Redo2 size={15} />, redo, history.future.length === 0)}
          <span className="rich-markdown-editor__divider" />
          {toolButton('Đậm (Ctrl+B)', <Bold size={15} />, () => wrapSelection('**'))}
          {toolButton('Nghiêng (Ctrl+I)', <Italic size={15} />, () => wrapSelection('*'))}
          {toolButton('Gạch dưới (Ctrl+U)', <UnderlineIcon />, () => wrapSelection('<u>', '</u>'))}
          {toolButton('Gạch ngang', <Strikethrough size={15} />, () => wrapSelection('~~'))}
          {!compact && (
            <>
              <span className="rich-markdown-editor__divider" />
              {toolButton('Cỡ chữ lớn (tiêu đề)', <Heading2 size={15} />, () => prefixLines((line) => `## ${line.replace(/^#{1,6}\s+/, '')}`))}
              {toolButton('Cỡ chữ vừa (tiêu đề nhỏ)', <Heading3 size={15} />, () => prefixLines((line) => `### ${line.replace(/^#{1,6}\s+/, '')}`))}
              {toolButton('Danh sách dấu chấm', <List size={15} />, () => prefixLines((line) => (line.trim() ? `- ${line.replace(/^[-*+]\s+/, '')}` : line)))}
              {toolButton('Danh sách số', <ListOrdered size={15} />, () => prefixLines((line, index) => (line.trim() ? `${index + 1}. ${line.replace(/^\d+[.)]\s+/, '')}` : line)))}
              {toolButton('Trích dẫn', <Quote size={15} />, () => prefixLines((line) => (line.trim() ? `> ${line}` : line)))}
              {toolButton('Mã code', <Code size={15} />, () => wrapSelection('`'))}
            </>
          )}
          {toolButton('Chèn liên kết', <Link2 size={15} />, insertLink)}
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
          {toolButton('Xóa định dạng', <Eraser size={15} />, clearFormatting)}
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
