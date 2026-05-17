import React, { ReactNode, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { MentionHighlightedText } from './MentionHighlightedText';

// Regex to detect @library/path pattern (for inline code)
const LIBRARY_PATH_PATTERN = /^@library\/(.+)$/;

/**
 * Process children to highlight library mentions in text nodes
 */
function processChildren(children: ReactNode, onPathClick?: (path: string) => void): ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string' && child.includes('@library/')) {
      return <MentionHighlightedText content={child} onPathClick={onPathClick} />;
    }
    return child;
  });
}

interface MarkdownContentProps {
  content: string;
  /** Callback when a library path is clicked */
  onPathClick?: (path: string) => void;
}

export const MarkdownContent = React.memo(function MarkdownContent({ content, onPathClick }: MarkdownContentProps) {
  return (
    <div dir="auto" className="prose prose-sm dark:prose-invert max-w-none" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
        // Inline code styling - with library path highlighting
        code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { node?: unknown }) => {
          // Determine if inline by checking if parent is not <pre>
          const isInline = !className?.includes('language-');
          
          if (isInline) {
            // Check if this is a library path reference
            const text = String(children).replace(/\n$/, '');
            const match = text.match(LIBRARY_PATH_PATTERN);
            
            if (match) {
              const path = match[1];
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPathClick?.(path);
                  }}
                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-sm font-medium text-[0.85em]
                    transition-all cursor-pointer
                    bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/50"
                  title={`Click to focus: ${path}`}
                >
                  {text}
                </button>
              );
            }
            
            return (
              <code
                className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-[0.805rem] font-mono"
                style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={`${className} text-slate-200`} style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }} {...props}>
              {children}
            </code>
          );
        },
        // Pre styling for code blocks
        pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
          <pre
            className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 my-2 text-[0.805rem] overflow-x-auto whitespace-pre-wrap break-words"
            {...props}
          >
            {children}
          </pre>
        ),
        // Paragraph styling - with library mention highlighting
        p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
          <p className="text-sm leading-relaxed m-0 mb-4 last:mb-0" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} {...props}>
            {processChildren(children, onPathClick)}
          </p>
        ),
        // List styling
        ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
          <ul className="list-disc list-outside mt-1 mb-4 space-y-1 text-sm ps-5" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
          <ol className="list-decimal list-outside my-2 space-y-3 text-sm ps-5" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
          <li className="text-sm leading-relaxed" {...props}>
            {processChildren(children, onPathClick)}
          </li>
        ),
        // Link styling
        a: ({ children, ...props }: ComponentPropsWithoutRef<'a'>) => (
          <a
            className="text-blue-600 dark:text-blue-400 hover:underline"
            style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),
        // Heading styling
        h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => (
          <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => (
          <h2 className="text-base font-bold mt-3 mb-2 first:mt-0" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => (
          <h3 className="text-sm font-bold mt-2 mb-1 first:mt-0" {...props}>
            {children}
          </h3>
        ),
        // Blockquote styling
        blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
          <blockquote
            className="border-s-4 border-slate-300 dark:border-slate-600 ps-4 italic my-2"
            {...props}
          >
            {children}
          </blockquote>
        ),
        // Table styling
        table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
          <div className="overflow-x-auto my-2">
            <table
              className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"
              {...props}
            >
              {children}
            </table>
          </div>
        ),
        th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => (
          <th
            className="px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-800"
            {...props}
          >
            {children}
          </th>
        ),
        td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => (
          <td className="px-3 py-2 text-sm" {...props}>
            {children}
          </td>
        ),
        // Image styling - skip empty src
        img: ({ src, alt, ...props }: ComponentPropsWithoutRef<'img'>) => {
          if (!src || (typeof src === 'string' && src.trim() === '')) return null;
          return (
            <img
              src={src}
              alt={alt || ''}
              className="max-w-full h-auto rounded-lg my-2"
              {...props}
            />
          );
        },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
