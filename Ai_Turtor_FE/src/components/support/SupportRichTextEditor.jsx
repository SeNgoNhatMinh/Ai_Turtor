import { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import {
  Bold,
  Code,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { htmlToPlainText, isRichTextEmpty, sanitizeRichHtml } from '../../utils/richText';
import { sanitizeLinkUrl } from '../../utils/markdownSecurity';
import './SupportRichTextEditor.css';

const TOOLS = [
  { cmd: 'bold', label: 'Đậm', icon: Bold, shortcut: 'Ctrl+B' },
  { cmd: 'italic', label: 'Nghiêng', icon: Italic, shortcut: 'Ctrl+I' },
  { cmd: 'underline', label: 'Gạch dưới', icon: Underline, shortcut: 'Ctrl+U' },
  { cmd: 'strikeThrough', label: 'Gạch ngang', icon: Strikethrough },
  { cmd: 'formatH3', label: 'Tiêu đề', icon: Heading3 },
  { cmd: 'insertUnorderedList', label: 'Danh sách', icon: List },
  { cmd: 'insertOrderedList', label: 'Danh sách số', icon: ListOrdered },
  { cmd: 'formatQuote', label: 'Trích dẫn', icon: Quote },
  { cmd: 'formatCode', label: 'Khối mã', icon: Code },
  { cmd: 'createLink', label: 'Chèn liên kết', icon: Link2 },
  { cmd: 'removeFormat', label: 'Xóa định dạng', icon: RemoveFormatting },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function queryState(command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function SupportRichTextEditor({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Trả lời sinh viên...',
  disabled = false,
  maxLength = 10000,
}) {
  const editorRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [active, setActive] = useState({});

  const emitChange = () => {
    const html = editorRef.current?.innerHTML || '';
    setIsEmpty(isRichTextEmpty(html));
    onChange?.(html);
  };

  const refreshActive = () => {
    if (!editorRef.current) return;
    setActive({
      bold: queryState('bold'),
      italic: queryState('italic'),
      underline: queryState('underline'),
      strikeThrough: queryState('strikeThrough'),
      insertUnorderedList: queryState('insertUnorderedList'),
      insertOrderedList: queryState('insertOrderedList'),
    });
  };

  useEffect(() => {
    if (!editorRef.current) return;
    if (isRichTextEmpty(value) && !isRichTextEmpty(editorRef.current.innerHTML)) {
      editorRef.current.innerHTML = '';
      setIsEmpty(true);
    }
  }, [value]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (!editorRef.current?.contains(document.activeElement) && document.activeElement !== editorRef.current) {
        return;
      }
      refreshActive();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const runCommand = (command) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();

    if (command === 'formatH3') {
      document.execCommand('formatBlock', false, 'h3');
    } else if (command === 'formatQuote') {
      document.execCommand('formatBlock', false, 'blockquote');
    } else if (command === 'formatCode') {
      document.execCommand('formatBlock', false, 'pre');
    } else if (command === 'createLink') {
      const raw = window.prompt('Nhập liên kết (https://...)', 'https://');
      const safe = sanitizeLinkUrl(raw);
      if (!safe) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        document.execCommand('insertHTML', false, `<a href="${escapeHtml(safe)}">${escapeHtml(safe)}</a>`);
      } else {
        document.execCommand('createLink', false, safe);
      }
    } else {
      document.execCommand(command, false, null);
    }

    emitChange();
    refreshActive();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') || '';
    if (html) {
      document.execCommand('insertHTML', false, sanitizeRichHtml(html));
    } else {
      document.execCommand('insertText', false, text);
    }
    emitChange();
  };

  const handleInput = () => {
    if (htmlToPlainText(editorRef.current?.innerHTML || '').length > maxLength) {
      document.execCommand('undo');
      return;
    }
    emitChange();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className={`support-rich-editor ${disabled ? 'is-disabled' : ''}`}>
      <div className="support-rich-editor__toolbar" role="toolbar" aria-label="Công cụ soạn thảo">
        {TOOLS.map(({ cmd, label, icon: Icon, shortcut }) => (
          <Tooltip key={cmd} title={shortcut ? `${label} (${shortcut})` : label}>
            <button
              type="button"
              className={`support-rich-editor__tool ${active[cmd] ? 'is-active' : ''}`}
              aria-label={label}
              aria-pressed={Boolean(active[cmd])}
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
                runCommand(cmd);
              }}
            >
              <Icon size={15} />
            </button>
          </Tooltip>
        ))}
      </div>
      <div
        ref={editorRef}
        className={`support-rich-editor__surface ${isEmpty ? 'is-empty' : ''}`}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={refreshActive}
        onBlur={emitChange}
      />
      <p className="support-rich-editor__hint">Enter xuống dòng. Ctrl + Enter để gửi.</p>
    </div>
  );
}

export default SupportRichTextEditor;
