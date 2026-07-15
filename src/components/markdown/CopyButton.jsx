import { memo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className={`ai-answer-copy-btn ${copied ? 'copied' : ''} ${className}`.trim()}
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy'}
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

export default memo(CopyButton);
