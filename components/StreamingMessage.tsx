'use client';

import { useRef, useEffect, memo } from 'react';
import { Agent } from '@/lib/agents';

interface StreamingMessageProps {
  content: string;
  agent: Agent;
}

/**
 * Renders the live streaming response as plain text only.
 * We intentionally avoid ReactMarkdown here — re-parsing markdown on every
 * token causes the entire virtual DOM subtree to be torn down and rebuilt,
 * which produces the "flashing" effect. Instead we append characters directly
 * to a <pre> via a ref so React never re-renders this component at all.
 */
const StreamingMessage = memo(function StreamingMessage({ content, agent }: StreamingMessageProps) {
  const preRef = useRef<HTMLPreElement>(null);

  // Directly set textContent rather than letting React reconcile on every token
  useEffect(() => {
    if (preRef.current) {
      preRef.current.textContent = content;
      // Keep scroll glued to bottom
      preRef.current.scrollIntoView({ block: 'end', behavior: 'nearest' });
    }
  }, [content]);

  return (
    <div className="flex gap-3 px-6 py-3">
      {/* Avatar */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-lg mt-1"
        style={{
          width: 28,
          height: 28,
          background: agent.accentColor,
          border: `1px solid ${agent.color}44`,
          fontSize: '0.85rem',
          lineHeight: 1,
        }}
      >
        {agent.emoji}
      </div>

      <div className="flex-1 min-w-0 max-w-4xl">
        {/* Agent label */}
        <div
          className="text-xs mb-1.5 font-medium"
          style={{
            color: agent.color,
            fontFamily: 'Syne, sans-serif',
            fontSize: '0.72rem',
          }}
        >
          {agent.name}
        </div>

        {/* Stream container — plain text, no markdown parsing */}
        <div
          style={{
            background: '#0D1117',
            border: '1px solid #1A2332',
            borderRadius: '0 12px 12px 12px',
            padding: '1rem 1.1rem',
          }}
        >
          <pre
            ref={preRef}
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '0.9rem',
              lineHeight: '1.7',
              color: '#C9D1D9',
              background: 'transparent',
            }}
          />
          {/* Blinking cursor */}
          <span className="cursor-blink" />
        </div>
      </div>
    </div>
  );
});

export default StreamingMessage;
