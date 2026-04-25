'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Copy, Check, User } from 'lucide-react';
import { Agent } from '@/lib/agents';
import { ChatMessage } from '@/lib/image-chat';

interface MessageBubbleProps {
  message: ChatMessage;
  agent: Agent;
  isStreaming?: boolean;
  onQuickReply?: (value: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="copy-btn flex items-center gap-1">
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

function CodeBlock({ inline, className, children, ...props }: CodeBlockProps) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  if (!inline && language) {
    return (
      <div className="code-block-wrapper">
        <div className="code-block-header">
          <span className="lang-badge">{language}</span>
          <CopyButton text={codeString} />
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus as Record<string, React.CSSProperties>}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: '#0D1117',
            fontSize: '0.8rem',
            lineHeight: '1.6',
            padding: '1rem',
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code
      className={className}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.82em',
        background: 'rgba(0,212,255,0.1)',
        color: '#00D4FF',
        padding: '0.15em 0.4em',
        borderRadius: '4px',
        border: '1px solid rgba(0,212,255,0.2)',
      }}
      {...props}
    >
      {children}
    </code>
  );
}

export default function MessageBubble({ message, agent, isStreaming, onQuickReply }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasVisuals = Boolean(message.attachments?.length || message.images?.length);

  if (isUser) {
    return (
      <div className="message-enter flex gap-3 px-6 py-3 justify-end">
        <div
          className="max-w-2xl rounded-2xl rounded-tr-sm px-4 py-3"
          style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.15)',
            color: '#E6EDF3',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
          {message.attachments?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: message.content ? 12 : 0 }}>
              {message.attachments.map((attachment, index) => (
                <img
                  key={`${attachment.name}-${index}`}
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid rgba(0,212,255,0.2)',
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full mt-1"
          style={{
            width: 28,
            height: 28,
            background: 'rgba(0,212,255,0.12)',
            border: '1px solid rgba(0,212,255,0.25)',
          }}
        >
          <User size={14} style={{ color: '#00D4FF' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="message-enter flex gap-3 px-6 py-3">
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-lg mt-1"
        style={{
          width: 28,
          height: 28,
          background: agent.accentColor,
          border: `1px solid ${agent.color}44`,
        }}
      >
        <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{agent.emoji}</span>
      </div>
      <div className="flex-1 min-w-0 max-w-4xl">
        {/* Agent name */}
        <div
          className="text-xs mb-1.5 font-medium"
          style={{ color: agent.color, fontFamily: 'Syne, sans-serif', fontSize: '0.72rem' }}
        >
          {agent.name}
        </div>
        {/* Content */}
        <div
          className="markdown-content"
          style={{
            background: '#0D1117',
            border: '1px solid #1A2332',
            borderRadius: '0 12px 12px 12px',
            padding: '1rem 1.1rem',
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: CodeBlock as React.ComponentType<React.ClassAttributes<HTMLElement> & React.HTMLAttributes<HTMLElement>> }}
          >
            {message.content}
          </ReactMarkdown>
          {message.images?.length ? (
            <div style={{ display: 'grid', gap: 10, marginTop: message.content ? 14 : 0 }}>
              {message.images.map((image, index) => (
                <a
                  key={`${image.model}-${index}`}
                  href={image.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                  }}
                >
                  <img
                    src={image.dataUrl}
                    alt={`Generated visual ${index + 1}`}
                    style={{
                      width: '100%',
                      maxWidth: 520,
                      borderRadius: 12,
                      border: `1px solid ${agent.color}33`,
                    }}
                  />
                </a>
              ))}
            </div>
          ) : null}
          {(message.meta?.model || hasVisuals) && !isStreaming ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 12,
                color: '#6B7280',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.62rem',
              }}
            >
              {message.meta?.model ? (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: '1px solid #1A2332',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {message.meta.fallbackUsed ? `Fallback: ${message.meta.model}` : message.meta.model}
                </span>
              ) : null}
            </div>
          ) : null}
          {message.meta?.quickReplies?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {message.meta.quickReplies.map(reply => (
                <button
                  key={reply}
                  onClick={() => onQuickReply?.(reply)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    border: `1px solid ${agent.color}33`,
                    background: agent.accentColor,
                    color: agent.color,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.66rem',
                    cursor: 'pointer',
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}
          {isStreaming && <span className="cursor-blink" />}
        </div>
      </div>
    </div>
  );
}
