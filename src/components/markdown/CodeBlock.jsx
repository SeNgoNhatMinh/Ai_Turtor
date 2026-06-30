import React, { memo, useMemo } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import CopyButton from './CopyButton';
import useThemeMode from './useThemeMode';

SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);

const LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'markup',
  xml: 'markup',
  md: 'markdown',
};

function inferLanguage(code) {
  const text = String(code || '').trim();
  if (!text) return 'text';
  if (/^\s*[{[]/.test(text)) return 'json';
  if (/<[a-z][\s\S]*>/i.test(text)) return 'markup';
  if (/\b(public|class|static|void|String)\b/.test(text)) return 'java';
  if (/\b(function|const|let|=>|console\.log)\b/.test(text)) return 'javascript';
  if (/\b(def|import|print|self)\b/.test(text)) return 'python';
  if (/\b(select|from|where|insert|update)\b/i.test(text)) return 'sql';
  return 'text';
}

function getLanguage(className, explicitLanguage, code) {
  const fromClass = String(className || '').match(/language-([\w-]+)/)?.[1];
  const raw = explicitLanguage || fromClass || inferLanguage(code);
  return LANGUAGE_ALIASES[raw] || raw || 'text';
}

function CodeBlock({ className = '', children, language: explicitLanguage }) {
  const code = useMemo(() => String(children || '').replace(/\n$/, ''), [children]);
  const language = useMemo(
    () => getLanguage(className, explicitLanguage, code),
    [className, explicitLanguage, code],
  );
  const themeMode = useThemeMode();
  const theme = themeMode === 'dark' ? vscDarkPlus : oneLight;

  return (
    <div className="ai-answer-code-block">
      <div className="ai-answer-format-toolbar">
        <span>{language === 'text' ? 'Code' : language}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language === 'text' ? undefined : language}
        style={theme}
        showLineNumbers={code.includes('\n')}
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '14px',
          background: 'transparent',
          fontSize: 13,
          lineHeight: 1.65,
        }}
        codeTagProps={{
          className: 'ai-answer-code',
        }}
        lineNumberStyle={{
          minWidth: '2.4em',
          paddingRight: '1em',
          color: themeMode === 'dark' ? '#9ca3af' : '#6b7280',
          userSelect: 'none',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default memo(CodeBlock);
