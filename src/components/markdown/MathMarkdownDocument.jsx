import { memo, useEffect, useRef } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import 'katex/dist/katex.min.css';
import MarkdownDocument from './MarkdownDocument';

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [[rehypeKatex, {
  throwOnError: false,
  strict: 'ignore',
  output: 'htmlAndMathml',
}], rehypeSlug];

function MathMarkdownDocument({ content, components }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const errors = rootRef.current?.querySelectorAll('.katex-error');
    if (errors?.length) {
      console.warn(
        'KaTeX could not parse part of the AI answer. Rendering raw formula text.',
        Array.from(errors).map((node) => node.textContent),
      );
    }
  }, [content]);

  return (
    <div ref={rootRef} className="ai-answer-math-document">
      <MarkdownDocument
        content={content}
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      />
    </div>
  );
}

export default memo(MathMarkdownDocument);
